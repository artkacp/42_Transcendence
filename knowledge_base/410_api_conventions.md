# 410 — REST API Conventions

How we design and structure the API. Applies to all backend contributors.

---

## URL layout

All API routes are prefixed `/api/`. Within that, routes are grouped by app:

```
/api/auth/          ← registration, login, token refresh, logout
/api/users/         ← profiles, friends
/api/pets/          ← listings, browse, adopt flow
/api/inquiries/     ← threads, messages, attachments
/api/notifications/ ← notification list + mark-read
/api/analytics/     ← event ingest, summary, daily series
/api/cities/        ← static city list
```

---

## Auth requirement

All endpoints require `Authorization: Bearer <access_token>` unless explicitly marked public. The access token lives in memory on the frontend — it is never stored in `localStorage`.

Public exceptions: register, login, token refresh, pet browse, public user profiles.

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

Not all list endpoints paginate — some (e.g. `/cities/`) return the full list.

---

## File uploads

Endpoints that accept files (avatar upload, pet photo, message attachment) use `multipart/form-data`. JSON-only clients need to handle this separately. DRF's `MultiPartParser` handles it — no extra config needed.

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
