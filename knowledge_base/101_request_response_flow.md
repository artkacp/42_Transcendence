# 101 — Request/Response Flow (REST)

How a typical API call travels from the browser to the database and back. Useful context for understanding any feature in the project.

---

## The path of a request

```
Browser (React)
  → nginx (port 8443, HTTPS)
    → Daphne (port 8000, HTTP)
      → Django URL router
        → DRF view
          → Serializer (validates input / formats output)
            → Django ORM
              → PostgreSQL
```

Every REST call follows this path. nginx terminates TLS and proxies `/api/` to the backend. Daphne is the ASGI server that runs Django. The URL router matches the path to a view. The view handles the logic and returns a response.

---

## Step by step

### 1. The browser makes a request

The frontend calls the API through `api/client.ts`. For example, fetching a list of pets:

```typescript
const pets = await get<Pet[]>('/api/pets/');
```

This sends: `GET https://localhost:8443/api/pets/` with an `Authorization: Bearer <access token>` header.

### 2. nginx receives it

nginx handles the HTTPS connection and forwards the request to `http://backend:8000`. It strips nothing — the `/api/` prefix is passed through.

### 3. Django routes it

`config/urls.py` maps URL prefixes to each app's router. `/api/pets/` matches the `pets` app router, which maps the path to `PetListView` (or a ViewSet action).

### 4. DRF authentication runs

Before the view runs, DRF checks the `Authorization: Bearer` header. `JWTAuthentication` decodes the token and attaches the matching user to `request.user`. If the token is missing or invalid, DRF returns 401 immediately and the view never runs.

### 5. Permissions are checked

The view declares a permission class (e.g. `IsAuthenticated`). DRF checks it before calling the view logic. A 403 is returned if the check fails.

### 6. The view runs

The view handles the business logic. For a list endpoint:

```python
class PetListView(generics.ListAPIView):
    serializer_class = PetSerializer
    queryset = Pet.objects.all()
    permission_classes = [IsAuthenticated]
```

For more complex logic, views call service functions, fire signals, or interact with models directly.

### 7. The ORM queries the database

`Pet.objects.all()` (or a filtered QuerySet) generates SQL and sends it to PostgreSQL. Django's database connection is a pool managed per-process.

### 8. The serializer formats the response

The view passes the model instance(s) to the serializer, which converts them to a Python dict, then Django renders that as JSON:

```json
[{"id": "...", "name": "Max", "species": "dog", ...}]
```

### 9. The response travels back

Django → Daphne → nginx (adds HTTPS headers) → browser. The frontend receives the JSON and updates the UI.

---

## Authentication in detail

Every request that requires a signed-in user sends:
```
Authorization: Bearer eyJ...
```

The JWT (JSON Web Token) is self-contained — it includes the user ID and an expiry timestamp, signed with a server secret. Django decodes it without touching the database. If expired, the frontend's `apiClient` intercepts the 401, uses the refresh cookie to get a new access token, and retries the original request automatically.

See note 420 for full auth and JWT details.

---

## Error responses

DRF returns standard HTTP codes:

| Code | Meaning |
|------|---------|
| 200 | OK — returned data |
| 201 | Created — POST that made a new object |
| 204 | No content — DELETE succeeded |
| 400 | Bad request — validation failed; body contains field errors |
| 401 | Unauthenticated — missing or expired token |
| 403 | Forbidden — authenticated but not allowed |
| 404 | Not found |
| 429 | Rate limited (public API only) |

Validation errors come back as a dict of field → list of errors:
```json
{"email": ["Enter a valid email address."]}
```

---

## Where to find things

| You want to... | Look in... |
|----------------|-----------|
| Add an endpoint | `<app>/views.py`, then wire it in `<app>/urls.py` |
| Change what fields are returned | `<app>/serializers.py` |
| Add a DB query | `<app>/views.py` or a service file — use the ORM, not raw SQL |
| Change URL structure | `<app>/urls.py`, then `config/urls.py` if it's a new app |
| See all routes | `config/urls.py` + each included `<app>/urls.py` |

---

## Further reading

- Note 401 — Django and DRF overview
- Note 410 — API conventions (naming, pagination, filtering)
- Note 420 — Auth and JWT in depth
- Note 430 — WebSocket flow (real-time, non-REST)
