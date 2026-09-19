# 401 — Django & Django REST Framework

Quick orientation for anyone new to the stack.

---

## Django

Django is a Python web framework with a "batteries included" philosophy — ORM, admin, auth, migrations, and a request/response cycle all built in. The project requires it as the backend framework.

Key concepts:
- **Project vs. app** — one Django project, multiple apps (`accounts`, `pets`, `inquiries`, etc.). Each app owns its models, views, and URLs.
- **`settings.py`** — central config: database, installed apps, middleware, static/media paths.
- **`urls.py`** — URL routing, defined at project level and per-app. Apps register their own routes and the project includes them.
- **`manage.py`** — CLI for migrations, running the dev server, creating apps, shell access.

Django runs as ASGI (not WSGI) on this project — see note 430 if you need the WebSocket side. For plain HTTP it behaves the same.

---

## Django REST Framework (DRF)

DRF sits on top of Django and adds the primitives for building REST APIs cleanly. It handles serialization, request parsing, authentication, permissions, and browsable API tooling.

Core abstractions:

| Concept | What it does |
|---------|-------------|
| **Serializer** | Converts model instances ↔ JSON; handles validation |
| **ViewSet** | Groups CRUD logic for a resource in one class |
| **Router** | Wires a ViewSet to URLs automatically |
| **Permission class** | Controls who can access a view (`IsAuthenticated`, custom) |
| **Authentication class** | Extracts the user from the request (JWT, session, etc.) |

Typical flow: request hits a URL → router forwards to a ViewSet action → serializer validates/serializes data → response.

---

## Project structure convention

The following is based on the TRD proposal and is subject to adjustment during implementation:

```
backend/
  project/          ← Django project (settings, root urls)
  accounts/         ← app: users, auth, friendships
  pets/             ← app: pet listings
  inquiries/        ← app: messages, attachments, adoption flow
  notifications/    ← app: notification model + push
  analytics/        ← app: event ingestion + aggregations
```

Each app follows the same internal layout: `models.py`, `serializers.py`, `views.py`, `urls.py`, `tests.py`.

---

## References

- Django docs: https://docs.djangoproject.com/
- DRF docs: https://www.django-rest-framework.org/
