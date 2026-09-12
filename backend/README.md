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

From the repo root:

```
docker-compose up --build
```

This currently brings up the `backend` and `db` services only. The frontend runs separately via `npm run dev` in `/frontend`. There is no Traefik/HTTPS in front of this yet — that's a later task.

## Verify it's working

1. `docker-compose logs backend` — confirm there are no startup errors and the dev server is watching for file changes.
2. `docker-compose exec backend python manage.py migrate` — confirm it completes without errors.
3. Visit `http://localhost:8000/admin/` — seeing a Django login page (even with no working credentials yet) confirms Daphne and Django are serving requests correctly.
