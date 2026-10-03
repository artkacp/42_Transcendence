# Backend

Django + DRF + Channels backend for Pawfect Match. This covers starting and verifying the service locally — see decision #12 in [knowledge_base/010_open_decisions.md](../knowledge_base/010_open_decisions.md#resolved) for the nginx single-origin deployment decision.

## Prerequisites

- Docker
- Docker Compose

## Setup

From the repo root, copy the example env file and fill in the values:

```
cp .env.example .env
```

## Start

All commands run from the repo root.

**Evaluation run** — what evaluators use. Runs a single Daphne process from the built image (no source bind mount, no hot reload), reached at `http://localhost:8080` through nginx. The backend port is not exposed:

```
docker-compose up --build
```

**Development** — layers `docker-compose.dev.yml` on top: Django's `runserver` with autoreload, `./backend` bind-mounted into the container, the backend published on `localhost:8000` and Postgres on `localhost:5432`. Direct backend access and the Django admin are dev-only:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

In both modes, migrations are applied automatically on container start (`backend/entrypoint.sh`), after Postgres passes its healthcheck.

Both modes also start `nginx` on `localhost:8080`: it serves the built frontend and proxies `/api/` and `/ws/` to the backend. For frontend hot reload, run `npm run dev` in `/frontend`. HTTPS is a later task.

## Verify it's working

1. `docker-compose logs backend` — confirm migrations were applied (or "No migrations to apply") with no errors, followed by Daphne listening on `0.0.0.0:8000` (or, in dev, the dev server watching for file changes).
2. Visit `http://localhost:8080` — the frontend should load. `http://localhost:8080/api/` should return Django's "Not Found" page (there are no API routes yet), which confirms nginx reaches the backend; a `502 Bad Gateway` means it doesn't.
3. Dev only: visit `http://localhost:8000/admin/` — a Django login page (even with no working credentials yet) confirms Django is serving requests directly.
