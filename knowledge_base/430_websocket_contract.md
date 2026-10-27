# 430 — WebSocket Contract

The one real-time channel between the browser and the backend, as built in B8. The code is in `backend/core/consumers.py`, `presence.py` and `realtime.py`. Owner: faikhan. The source spec is TRD §6.7; differences from it are noted below.

---

## Connection

- Endpoint: `wss://localhost:8443/ws/`, same origin, through nginx (note 601). Each signed-in tab opens one socket.
- The handshake's `Origin` is checked against `ALLOWED_HOSTS` (Channels' `AllowedHostsOriginValidator`). A socket opened from another website is rejected.
- The socket has no cookie or session auth. Authentication happens in the first frame.

---

## Authentication (first frame)

The client's first frame must be:

```json
{"type": "auth", "token": "<access token>"}
```

`token` is the same access JWT that REST requests send as `Authorization: Bearer` (note 420).

| Client's first frame | Server |
|---|---|
| `auth` with a valid access token for an active user | `{"type": "auth.ok"}`. The socket is now signed in. |
| `auth` with a missing, invalid or expired token | `{"type": "auth.error"}`, then close with code **4401**. |
| Anything else (another `type`, not JSON, binary) | Close with **4401**, without sending `auth.error`. |
| Nothing within 10 s (`WS_AUTH_TIMEOUT` in settings) | Close with **4401**. |

- The token is checked once, at auth. The socket stays open after the access token expires; a new token is only needed to reconnect.
- After `auth.ok`, frames with an unknown `type` are ignored with no reply and no close. That includes a second `auth`.
- On a 4401, the client should refresh its access token (note 420) before reconnecting, rather than retrying with the same token.

---

## Casing and payloads

Every frame is a JSON object with a `type`. Every key is **snake_case** in both directions (`inquiry_id`, `attachment_ids`, `user_id`, `adopted_by_id`). IDs are UUID strings.

The embedded objects (`message`, `inquiry`, `pet` and `notification`) are the same serializer output as the matching REST endpoints.

---

## Client → server frames

These are accepted only after `auth.ok`.

| `type` | Fields | Effect |
|---|---|---|
| `chat.send` | `inquiry_id`, `body`, `attachment_ids` | Sends a chat message in an inquiry thread. See the rules below. |
| `pet.subscribe` | `pet_id` | Joins `pet.<id>` to get live updates for that pet's page. Any signed-in user may subscribe, because listings are public. The pet is not looked up: an unknown id simply never receives anything. Subscribing twice has no effect. |
| `pet.unsubscribe` | `pet_id` | Leaves `pet.<id>`. Has no effect if not subscribed. |
| `analytics.subscribe` | — | Joins the `analytics` group to receive `analytics.ping`. Send when the analytics dashboard mounts; re-send after reconnect. |
| `analytics.unsubscribe` | — | Leaves the `analytics` group. Send when the analytics dashboard unmounts. |

`chat.send` rules:
- It uses the same validation and service as the REST fallback `POST /api/inquiries/{id}/messages/`.
- `body` (default `""`) and `attachment_ids` (default `[]`) are each optional, but at least one must be non-empty.
- The sender must be one of the two parties in the thread.
- Each attachment must have been uploaded by the sender and not yet sent.
- There is no success reply: the sender receives the resulting `chat.message`, just like the other party.

If a frame is rejected, the server sends an `error` frame (see below) and the socket stays open.

---

## Server → client frames

| `type` | Payload | Sent to |
|---|---|---|
| `auth.ok` | — | this socket |
| `auth.error` | — | this socket, right before close 4401 |
| `presence.changed` | `user_id`, `online` (bool) | `browse` |
| `chat.message` | `message` | `user.<owner>` and `user.<adopter>` of the thread |
| `inquiry.created` | `inquiry` | `user.<pet owner>` |
| `inquiry.stage_changed` | `inquiry_id`, `stage` | `user.<owner>` and `user.<adopter>` |
| `pet.published` | `pet` | `browse` |
| `pet.adopted` | `pet_id`, `adopted_by_id` | `pet.<id>` and `browse` |
| `pet.removed` | `pet_id` | `pet.<id>` and `browse` |
| `notification.created` | `notification` | `user.<recipient>` |
| `analytics.ping` | — | `analytics` |
| `error` | `for`, `detail` | this socket |

`error` is **an addition to the TRD**. Its fields:
- `for` is the `type` of the client frame it answers.
- `detail` is a single string:
  - A validation error gives its first message, for example "Must be a valid UUID."
  - A thread that doesn't exist and a thread you're not part of both give "Not found.", as in REST, so the reply doesn't reveal which threads exist.
  - An unexpected server error gives "Something went wrong."

---

## Groups

| Group | Members | Carries |
|---|---|---|
| `user.<id>` | Every authenticated socket of that user, joined at auth | The user's own `notification.created`; `inquiry.created` (to the pet owner); `chat.message` and `inquiry.stage_changed` for threads the user is a party to |
| `browse` | Every authenticated socket, joined at auth | `presence.changed`, `pet.published`, `pet.adopted`, `pet.removed` |
| `pet.<id>` | Sockets that sent `pet.subscribe` for that pet | `pet.adopted` and `pet.removed` for that pet |
| `analytics` | Sockets that sent `analytics.subscribe` (opt-in) | `analytics.ping` |

Every socket is in `browse`, so a socket subscribed to `pet.<id>` receives that pet's `pet.adopted` and `pet.removed` **twice**, once from each group. Clients must handle these frames idempotently.

All groups are left automatically on disconnect, `pet.<id>` included.

### Why chat goes to the participants, not to `pet.<id>`

Any signed-in user can join `pet.<id>`, because listings are public, so anything sent to that group is effectively public. Chat messages and stage changes are private to the two people in the thread. They therefore go only to the owner's and the adopter's `user.<id>` groups. Before B8 they were pushed to `pet.<id>`; B8 moved them.

---

## Presence

- The source of truth is an in-memory count of open authenticated sockets per user (`core/presence.py`). A user with three tabs open has a count of 3. A socket closed with 4401 is never counted.
- Only transitions trigger anything:
  - The first socket (0 → 1) makes the user online.
  - Closing the last socket (1 → 0) makes the user offline.
- On each transition, the backend:
  1. writes `User.is_online`, plus `last_seen_at` when going offline, so that REST responses can show it;
  2. sends `presence.changed` to `browse`.
- A user never receives their own `presence.changed`: the first socket is counted before it joins `browse`, and when going offline no socket is left.
- After a backend restart nobody is connected, so on startup `manage.py reset_presence` sets `is_online = False` for every user. `backend/entrypoint.sh` runs it after `migrate` and before Daphne starts. It must never run from `AppConfig.ready()`, which also runs during `migrate`.
- **One-process rule.** The channel layer (`InMemoryChannelLayer`) and this count both exist once per process. A second backend process would have its own groups and counts. Sockets on one process would never see events pushed from the other, and presence would be wrong, with no error raised. See the README, "Architecture: one backend process".

---

## Pushing an event (backend)

Code that changes state calls `core.realtime.push(group, type, **payload)`. The frame's `type` doubles as the channel-layer message type. The consumer forwards every message that isn't a `websocket.*` event to the client unchanged, so the client receives exactly the keyword arguments passed to `push()`. Keep payload keys snake_case and JSON-serialisable; Django's JSON encoder handles UUIDs.
