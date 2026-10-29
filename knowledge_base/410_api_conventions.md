# 410 — REST API Conventions

How we design and structure the API. Applies to all backend contributors.

---

## URL layout

The following URL structure is based on the TRD proposal and is subject to adjustment during implementation.

The API has two namespaces with different auth models:

### App API — JWT authenticated

```
/api/auth/          ← registration, login, token refresh, logout
/api/users/         ← profiles, friends
/api/pets/          ← listings, browse, adopt flow
/api/inquiries/     ← threads, messages, attachments
/api/notifications/ ← notification list + mark-read
/api/analytics/     ← platform dashboard (Django ORM, reads analytics_event) + per-user rollups
/api/cities/        ← static city list
```

### Public API — API key authenticated

```
/api/public/v1/     ← read-only, third-party access
```

Authenticated by a hashed `X-API-Key` header. Keys are long-lived, stored hashed (shown once at creation), and rate-limited at 60 requests/min per key via Django's `LocMemCache`-backed throttle. An OpenAPI schema and docs page are served alongside. This is a separate trust boundary from the SPA — keys are never mixed into the JWT session flow. See note 420 for the JWT side.

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
