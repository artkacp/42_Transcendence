# 330 — Live Chat: Frontend Side

How the browser connects to the WebSocket, turns REST history and live frames into one message list, and recovers after a dropped connection. The code is in `frontend/src/socket/` (`useSocket.ts`, `SocketProvider.tsx`, `SocketContext.ts`, `frames.ts`) and `frontend/src/views/PetChat.tsx`. Owner: oostapen. The server side, frame shapes and close codes are in note 430.

---

## Code map

| Piece | File | Role |
|---|---|---|
| `useSocket` | `socket/useSocket.ts` | opens the socket, first-frame auth, backoff, reauth |
| `SocketProvider` | `socket/SocketProvider.tsx` | one socket per tab, frame dispatch, `pet.subscribe` on ready |
| `useSocketFrame` | `socket/SocketContext.ts` | subscribe a component to one frame type |
| `useSocketReconnect` | `socket/SocketContext.ts` | callback on every reconnect, never on the first connect |
| `PetChat` | `views/PetChat.tsx` | thread view: history, live merge, send, recovery |
| `getMessages` | `api/inquiries.ts` | `GET /api/inquiries/{id}/messages/` |

---

## 01 · Connection

```
 AuthProvider
 ╰── SocketProvider ── useSocket(signed-in) ──╮      signed out → no socket at all
                                              │
                    wss://host/ws/ ─ nginx ───┤
                                              ▼
 ┌─ browser · one per tab ───┐        ┌─ ChatConsumer · Daphne ─────────────┐
 │                           │        │ ◉ connect                           │
 │                           │        │   accept · deadline 10 s            │
 │ ◑ onopen                  │        │                                     │
 │   {type:auth, token} ─────┼───────▶│ ◉ first frame only                  │
 │                           │        │   ├ not auth ───────────▶ 4401      │
 │   authFailed ◀────────────┼────────┤   ├ bad token ─ auth.error ─ 4401   │
 │   ╰ reauth (see 03)       │        │   ╰ ok                              │
 │                           │        │     presence.join · announce        │
 │ ◕ status ready ◀──────────┼────────┤     groups  user.<pk> · browse      │
 │   onReady ─ pet.subscribe─┼───────▶│     + pet.<id> · analytics on ask   │
 │                           │        │                                     │
 │ useSocketFrame(type, fn)  │        │ ◉ frame fails → {error, for, detail}│
 │ Map<type, Set<handler>>   │        │ ◉ disconnect                        │
 │ handlerRef ← every render │        │   presence.leave → announce         │
 └───────────────────────────┘        └─────────────────────────────────────┘
 ╭●╯≡◕ token never in the URL · handlers subscribe once, read fresh state via ref
```

- The socket exists only while signed in (`useSocket.ts:36`). Signing out cancels any pending retry and closes it (`useSocket.ts:114-120`).
- The first frame carries the access token (`useSocket.ts:53-54`), so it never appears in a URL or a server log.
- `useSocketFrame` keeps the handler in a ref updated on every render. The subscription effect depends only on `[listen, type]`, so a new handler function per render does not re-subscribe, yet the handler always sees current state (`SocketContext.ts:32-45`).

---

## 02 · Message flow

```
    open thread                                send
        │                                        │
 GET /api/inquiries/{id}/messages/        send({chat.send, inquiry_id, body})
 newest 30 · newest first                  ╭─────┴──────────────╮
        │                             true │                    │ false: socket not ready
        │                        pending = body                 ▼
        │                                  │       POST /api/inquiries/{id}/messages/
        │                                  ▼                    │
        │                     ◉ send_message()                  │
        │                       ├ sender is a party             │
        │                       ├ save Message                  │
        │                       ╰ push chat.message             │
        │                         ╭───────┴───────╮             │
        │                     user.<sender>   user.<recipient>  │
        │                       (echo)            │             │
        ▼                         ╰───────┬───────╯             │
  reverse → old→new         useSocketFrame('chat.message')      │
        │                   other inquiry → ignore              │
        │                                 │                     │
        ╰──────────▶ withMessage(list, msg) ◀───────────────────╯
                     dedupe by id · append · arrival order
                                  │
                                  ▼
                        ◕ one list · PetChat
   own echo ── clears draft + pending
   error {for: chat.send} ── clears pending, shows detail
 ╭●╯≡◕ no optimistic copy: a message appears only after the server saved it
       same id from REST + echo → dedupe keeps one
```

- REST and WebSocket are not two chats: both feed the same `withMessage` (`PetChat.tsx:18-23`), which drops a message whose `id` is already in the list.
- There is no optimistic message. A socket send only stores the body as `pending` (`PetChat.tsx:122-124`); the message is shown when the server's echo arrives.
- When `send()` returns false (socket not ready), the REST fallback posts the message and merges the response through the same function (`PetChat.tsx:126-134`).
- List previews follow the same frames: Adoptions dedupes on `last_message.id` and moves the row to the top; PetInquiries updates `last_message` in place.

---

## 03 · Recovery

```
 ◉ ready ── drop ──▶ ◉ closed
                        │
          ╭─────────────┴──────────────╮
     4401 · auth                  any other close
          │                            │
   reauth: REST refresh once     retryLater()
   ├ ok ─ reconnect now          delay = min(1 s·2ⁿ, 30 s) × rand(0.5–1)
   ╰ fail ─ closed, stop         1 → 2 → 4 … 30 s · no max · n = 0 on auth.ok
          ╰─────────────┬──────────────╯
                        ▼
              ◉ auth.ok · not the first one
                        │
        ╭───────────────┼──────────────────────╮
        ▼               ▼                      ▼
   pet.subscribe   ◑ PetChat              PetInquiries · Adoptions
   re-sent           pending = ∅           reload whole list
                     reload++
                     GET newest 30
                     REPLACE list
                        ╰──────────┬───────────╯
                                   ▼
                       ◕ consistent with the server
 ╭●╯≡◕ in-memory channel layer keeps no history → REST is the only way back
```

- Backoff: `min(1000·2^attempt, 30000)` ms × random 0.5–1, no attempt limit, reset on `auth.ok` (`useSocket.ts:12, 91-94`).
- A 4401 close triggers one token refresh through the shared REST `refresh()`, then an immediate reconnect; a second failure stops with status `closed` (`useSocket.ts:100-109`).
- Frames pushed while the client was offline are never replayed: the channel layer is in memory, in one Daphne process (see README, "Architecture: one backend process"). So a reconnect refetches, and the thread is replaced, not merged: the server list is the truth (`PetChat.tsx:96-99`).

---

## Where the work is

| | Problem | Solution |
|---|---|---|
| ◔ | two inputs, one list | REST page + live frames → `withMessage`, dedupe by id |
| ◑ | socket handlers vs React state | subscribe once (`[listen, type]`), fresh state through `handlerRef` |
| ◕ | nothing is replayed | reconnect = refetch + replace |
| ● | auth over the socket | first frame, 10 s deadline, 4401 → one token refresh, then stop |

---

## Known limits (as built)

- Only the newest 30 messages load. The backend supports `?before=<message id>`; the UI does not send it yet.
- Messages are shown in arrival order, with no `created_at` sort. One Daphne process pushes frames in order.
- A message sent right before a drop reappears through the refetch, if the server saved it.

---

See also: note 430 (WebSocket contract, server side), note 420 (JWT and refresh), note 601 (nginx and HTTPS).
