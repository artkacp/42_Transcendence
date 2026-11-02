# 410 — REST API Conventions

How we design and structure the API. Applies to all backend contributors.

---

## URL layout

The API has two namespaces with different auth models:

### App API — JWT authenticated

```
/api/auth/          ← registration, login, token refresh, logout
/api/users/         ← user list (Friends > Discover), profiles, friends
/api/pets/          ← listings, browse, adopt flow
/api/pet-options/   ← the values the pet forms and filters accept
/api/inquiries/     ← threads, messages
/api/attachments/   ← chat attachment upload, removal, download
/api/keys/          ← create, list and revoke your public API keys
/api/notifications/ ← notification list + mark-read
/api/analytics/     ← platform dashboard (Django ORM, reads analytics_event) + per-user rollups
```

### Public API — API key authenticated

```
/api/public/v1/     ← third-party access: read pets + options; create, update and delete own pets
```

Authenticated by a hashed `X-API-Key` header. Keys are long-lived, stored hashed (shown once at creation), and rate-limited at 60 requests/min per key via Django's `LocMemCache`-backed throttle. An OpenAPI schema and docs page are served alongside. This is a separate trust boundary from the SPA — keys are never mixed into the JWT session flow. See note 420 for the JWT side.

---

## Auth requirement

All endpoints require `Authorization: Bearer <access_token>` unless explicitly marked public. The access token lives in memory on the frontend — it is never stored in `localStorage`.

Public exceptions: register, login, token refresh. Browse and user profiles need a signed-in user. The public API uses its own key, and its schema and docs pages are open.

---

## Response format

Successful responses return the resource directly (no outer wrapper). Errors use a shared envelope:

```json
{
  "error": "validation_failed",
  "detail": "...",
  "fields": { "email": ["Enter a valid email address."] }
}
```

DRF's default error format is close to this — agree on exact field names early so the frontend can rely on them.

---

## Pagination

List endpoints that back a paginated UI use page-based pagination with a fixed page size of 6. Response shape:

```json
{
  "count": 42,
  "next": "/api/pets/?page=2",
  "previous": null,
  "results": [...]
}
```

Notifications use the same shape with a page size of 30. Not all list endpoints paginate: `/api/users/` and `/api/pet-options/` return everything.

---

## Browse filters and sorting

`GET /api/pets/` and `GET /api/public/v1/pets/` accept the same query parameters: `q`, `species`, `sex`, `size`, `age_bucket`, `city`, `breed`, `trait`, `vaccinated`, `neutered` and `page`, validated by `PetFilterSerializer`.

`ordering` is one of `-created_at` (default), `created_at`, `name`, `age_years`, `-age_years`. Any other value returns 400.

---

## User list

`GET /api/users/` returns active users except the caller, ordered by `full_name`, each with their friendship state towards the caller. It uses the public profile serializer, so no email is exposed.

---

## Input limits

| Field | Limit |
|-------|-------|
| User bio | 500 characters |
| Pet story | 20 to 2000 characters |
| Message body | 2000 characters |
| Avatar | 2 MB |
| Pet photo, attachment | 5 MB |

The REST and WebSocket message paths share the same serializer. Once a pet is adopted its threads are closed: sending a message returns 403.

---

## File uploads

Endpoints that accept files (avatar upload, pet photo, message attachment) use `multipart/form-data`. JSON-only clients need to handle this separately. DRF's `MultiPartParser` handles it — no extra config needed.

Allowed types live in `core/validators.py`. Avatars and pet photos: PNG, JPEG, WebP, GIF, also verified as real images. Attachments: those plus PDF, TXT, MD, CSV, DOCX; the extension and the declared content type are checked, not the file contents.

A sent attachment can't be deleted on its own: it stays with the conversation and is removed with the listing. See note 010, decision F-5.

---

## HTTP methods convention

| Action | Method |
|--------|--------|
| Read list | GET |
| Read single | GET |
| Create | POST |
| Partial update (some fields) | PATCH |
| Full replacement (rarely used) | PUT |
| Delete | DELETE |

Use `PATCH` for updates rather than `PUT` — frontend sends only the fields it changed.
