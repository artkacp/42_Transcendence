# Backend

Django + DRF + Channels backend for Pawfect Match. This covers starting and verifying the service locally — see [CLAUDE.md](../CLAUDE.md) and [knowledge_base/601_https_and_network_access.md](../knowledge_base/601_https_and_network_access.md) for the fuller architecture and deployment decisions.

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

**Evaluation run** — what evaluators use. Runs a single Daphne process from the built image (no source bind mount, no hot reload):

```
docker-compose up --build
```

**Development** — layers `docker-compose.dev.yml` on top: Django's `runserver` with autoreload, `./backend` bind-mounted into the container, and Postgres published on `localhost:5432`:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

In both modes, migrations are applied automatically on container start (`backend/entrypoint.sh`), after Postgres passes its healthcheck.

This currently brings up the `backend` and `db` services only. The frontend runs separately via `npm run dev` in `/frontend`. There is no Traefik/HTTPS in front of this yet — that's a later task.

## Verify it's working

1. `docker-compose logs backend` — confirm migrations were applied (or "No migrations to apply") with no errors, followed by Daphne listening on `0.0.0.0:8000` (or, in dev, the dev server watching for file changes).
2. Visit `http://localhost:8000/admin/` — seeing a Django login page (even with no working credentials yet) confirms Daphne and Django are serving requests correctly.
