*This project has been created as part of the 42 curriculum by faikhan, oostapen, sarherna, iskaraag, akacprzy.*

# Pawfect Match

## Description

A peer-to-peer adoption platform for dogs and cats: people rehoming a pet list it, and people looking to adopt browse the listings and talk to the owner directly.

## Features

- **Browse and adopt** — search listings by species, breed, size, age and location; filter in real time; send an adoption application directly to the owner *(iskaraag, sarherna)*
- **Rehome a pet** — publish a listing with photos, description and pet details *(iskaraag, sarherna)*
- **Chat** — real-time messaging between owner and applicant over WebSocket, scoped to each adoption inquiry *(oostapen, faikhan, sarherna)*
- **Adoptions** — track the status of your applications as an adopter; manage incoming inquiries and move them through adoption stages as an owner *(iskaraag, faikhan, sarherna)*
- **Notifications** — in-app notifications for application status changes and adoption confirmations, delivered in real time *(iskaraag, sarherna)*
- **Friends** — send and accept friend requests, see who is online, browse your friends list and discover new people *(artkacp, sarherna)*
- **Analytics dashboard** — platform-wide adoption metrics and charts (visits, applications, adoptions, active users over time), filterable by pet type and date range, with CSV export *(artkacp)*
- **Personal stats** — per-user activity summary: pets viewed, applications sent, listings published, adoptions completed *(artkacp, iskaraag)*

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Django 5.2, Django REST Framework 3.18 |
| Real-time | Django Channels 4.3, Daphne 4.2 (ASGI server) |
| Database | PostgreSQL |
| ORM | Django ORM (all tables) + SQLAlchemy 2.1 (analytics only) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| File handling | Pillow 12, Django FileField |
| Infrastructure | Docker, nginx (reverse proxy + TLS termination + static files) |
| Monitoring | Prometheus (django-prometheus + node-exporter), Grafana |

The backend is a single Django application served by Daphne, handling both REST requests and WebSocket connections in one process. Django Channels adds WebSocket support without a separate server or message broker. The in-memory channel layer keeps the setup simple — see [Architecture: one backend process](#architecture-one-backend-process).

PostgreSQL is used for its native array and JSONB column types (pet traits, event metadata) and for GIN trigram indexes that power full-text search.

SQLAlchemy 2.1 is used alongside Django ORM to satisfy the ORM module requirement. It owns the `analytics_event` table exclusively; Django ORM owns all other tables. The schema is created by a Django `RunSQL` migration; SQLAlchemy maps the existing table and never emits DDL.

## Database Schema

All tables use UUID primary keys. The `analytics_event` table is owned by SQLAlchemy; all others are managed by Django migrations.

### accounts_user

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| email | varchar(254) | Unique |
| full_name | varchar(150) | |
| handle | varchar(50) | Unique, auto-generated from full name |
| city | varchar(100) | Optional |
| bio | text | Optional |
| avatar | file | Optional |
| is_online | boolean | Updated by WebSocket presence |
| last_seen_at | timestamptz | |
| date_joined | timestamptz | |
| is_active | boolean | |
| is_staff | boolean | |

### accounts_friendship

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| requester_id | UUID | FK → accounts_user |
| addressee_id | UUID | FK → accounts_user |
| status | varchar(10) | `pending` / `accepted` |
| created_at | timestamptz | |

Constraints: `unique(requester, addressee)`; `requester ≠ addressee`.

### pets_pet

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| owner_id | UUID | FK → accounts_user |
| name | varchar(100) | |
| species | varchar(10) | `dog` / `cat` |
| breed | varchar(100) | |
| age_years | smallint | 0–40 |
| size | varchar(10) | `small` / `medium` / `large` |
| sex | varchar(10) | `male` / `female` |
| city | varchar(100) | |
| story | text | Min. 20 chars |
| traits | varchar[] | Up to 4 values |
| photo | file | Optional |
| is_vaccinated | boolean | |
| is_neutered | boolean | |
| adopted_by_id | UUID | FK → accounts_user, nullable |
| adopted_at | timestamptz | Nullable |
| search_text | text | Denormalised for GIN trigram search |
| created_at | timestamptz | |

Indexes: `GIN(search_text)` (trigram ops), `(species, size, city)`, `(-created_at)`.

### inquiries_inquiry

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| pet_id | UUID | FK → pets_pet |
| adopter_id | UUID | FK → accounts_user |
| stage | varchar(15) | `conversation` / `visit` / `decision` / `denied` |
| last_message_at | timestamptz | Nullable |
| created_at | timestamptz | |

Constraint: `unique(pet, adopter)`.

### inquiries_message

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| inquiry_id | UUID | FK → inquiries_inquiry |
| sender_id | UUID | FK → accounts_user |
| body | text | |
| created_at | timestamptz | |

### inquiries_attachment

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| message_id | UUID | FK → inquiries_message, nullable |
| uploaded_by_id | UUID | FK → accounts_user |
| file | file | |
| original_name | varchar(255) | |
| content_type | varchar(100) | |
| size_bytes | integer | Max 5 MB |
| kind | varchar(10) | `image` / `document` |
| created_at | timestamptz | |

### notifications_notification

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| recipient_id | UUID | FK → accounts_user |
| kind | varchar(10) | `create` / `update` / `delete` / `info` |
| title | varchar(200) | |
| body | text | |
| is_read | boolean | |
| subject_type | varchar(50) | Optional — type of the related object |
| subject_id | UUID | Optional — id of the related object |
| created_at | timestamptz | |

Indexes: `(recipient, -created_at)`; partial `(recipient) WHERE is_read = false`.

### api_apikey

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| owner_id | UUID | FK → accounts_user |
| label | varchar(100) | |
| prefix | varchar(8) | Unique — first 8 chars of the key, used for lookup |
| key_hash | varchar(64) | SHA-256 hex digest of the full key |
| rate_per_minute | integer | Nullable — null means 60 req/min default |
| created_at | timestamptz | |
| last_used_at | timestamptz | Nullable |
| revoked | boolean | |

### analytics_event

Owned by SQLAlchemy. Created via Django `RunSQL` migration.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | References accounts_user (no FK constraint) |
| pet_id | UUID | Optional (no FK constraint) |
| event_type | varchar(30) | e.g. `pet_viewed`, `application_sent`, `listing_published` |
| occurred_at | timestamptz | Server default: `now()` |
| metadata | JSONB | Additional event data |

## Modules

Total: **20 points** (7 Majors × 2 pts + 6 Minors × 1 pt). The subject requires 14 points to pass.

| Module | Type | Pts | Implementation | Implementer(s) |
|--------|------|-----|----------------|----------------|
| Framework (Django + React) | Major | 2 | Django 5.2 + DRF for the REST API; React 19 + TypeScript + Vite for the frontend | sarherna, artkacp, faikhan, oostapen, iskaraag |
| Standard User Management | Major | 2 | Registration, JWT auth (access token in-memory, refresh in httpOnly cookie), profile with avatar upload, account settings | sarherna (backend B1/B2), oostapen (F1 auth flow), sarherna (F7 profile) |
| User Interaction | Major | 2 | Adoption inquiry chat over WebSocket; friend requests and acceptance; profile views for own and other users | sarherna (B5/B6 inquiries), faikhan (B8 chat routing), oostapen (F3b chat UI), artkacp (B3/F6 friends), iskaraag (F8 notifications), sarherna (F7) |
| Real-time Features | Major | 2 | Django Channels WebSocket; group-based broadcasting (user, pet, browse groups); first-frame JWT auth; graceful disconnect; live updates in Browse, Adoptions and Friends | faikhan (B8, F5 socket), iskaraag (F2/F4/F5 views), artkacp (F6) |
| Public API | Major | 2 | API key management (SHA-256 hashed, shown once); 60 req/min throttle via LocMemCache; GET/POST/PUT/DELETE pets, GET users; OpenAPI schema + Swagger UI | faikhan |
| Prometheus / Grafana | Major | 2 | django-prometheus (request rate, latency, status codes); node-exporter (host metrics); Grafana "Pawfect Match — Ops" dashboard with BackendDown firing alert | faikhan (D3/D4), artkacp (A3 instrumentation) |
| Advanced Analytics Dashboard | Major | 2 | Platform-wide metrics from analytics_event via Django ORM; date range + pet type filters; Recharts frontend; CSV export | artkacp (A4 backend, F9 frontend) |
| Notification system | Minor | 1 | Notification model; real-time delivery to user WebSocket group; badge count, notification center, mark-read | sarherna (B7 service), iskaraag (F8 notification center + toast) |
| Custom Design System | Minor | 1 | 10+ components (Button, Card, Avatar, Toggle, Select, Chip, Progress, Modal, Toast, Tabs, Input, IconButton); OKLCH palette; semantic token layer; Tailwind v4 `@theme` | oostapen, iskaraag |
| Advanced Search | Minor | 1 | Filters by species, breed, size, age bucket, city; GIN trigram full-text search on name/breed/traits; debounced input; paginated results | iskaraag (F2 frontend), sarherna (B4 backend) |
| File Upload | Minor | 1 | Pet photos (JPEG/PNG/WebP), user avatars, message attachments (image + document); Pillow image handling; 5 MB limit; type allowlist | sarherna (B4 pets, B2 avatar), iskaraag (F4 publish modal) |
| User Activity Analytics | Minor | 1 | SQLAlchemy write pipeline records events on every significant action; `/api/analytics/me/` returns seeker stats (views, applications, adoptions) + rehomer stats (listings, views received, inquiries, adoptions out) | artkacp (A2 pipeline, A5 endpoint) |
| ORM (SQLAlchemy) | Minor | 1 | SQLAlchemy 2.1 with `mapped_column` declarative style; owns `analytics_event` exclusively; schema created by Django `RunSQL` migration, SQLAlchemy never emits DDL | artkacp (A1 schema, A2 mapping) |

## Team Information

| Login | Role | Area |
|-------|------|------|
| sarherna | Product Owner, Technical Lead | Backend: auth, user management, pets, inquiries, adoption stages, notifications service, profile view |
| akacprzy | Project Manager | Database schema, analytics write pipeline, analytics endpoints, friends backend and view |
| faikhan | Developer | DevOps, Docker, nginx, HTTPS, WebSocket backend, public API, Prometheus/Grafana |
| oostapen | Developer | Frontend: auth flow, API client, routing, pet page, design system foundation |
| iskaraag | Developer | Frontend: browse, rehome, adoptions view, notifications, design system components |

All team members contributed as developers across the full stack.

## Project Management

Work is tracked in Notion (implementation plan and Kanban board). Each task has a scope definition, requirement references and acceptance criteria.

Code review is handled through GitHub pull requests — all code is merged via PR, no direct pushes to main. Each PR goes through at least one review before merging.

Team communication is via Slack. The team meets weekly or bi-weekly to sync on progress and decisions.

## Public API

Third-party clients can access pet and user data using an API key. Keys are tied to a user account and rate-limited to 60 requests per minute by default.

### Getting a key

Sign in to the app and create a key from your profile. Or use the REST endpoint directly:

```sh
# 1. Sign in and get an access token
curl -k -s -X POST https://localhost:8443/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com", "password": "yourpassword"}' | jq -r '.access'

# 2. Create an API key
curl -k -s -X POST https://localhost:8443/api/auth/apikeys/ \
  -H "Authorization: Bearer <access_token>" \
  -H 'Content-Type: application/json' \
  -d '{"label": "my-key"}'
```

The response includes the full key once — it is not shown again. It is stored hashed (SHA-256).

### Using the API

```sh
curl -k -s https://localhost:8443/api/public/v1/pets/ \
  -H 'X-API-Key: <your-key>'
```

### Documentation

- OpenAPI schema: `https://localhost:8443/api/public/v1/schema/`
- Swagger UI: `https://localhost:8443/api/public/v1/docs/`

## Instructions

### Prerequisites

- Docker with Compose v2 (`docker compose`). Rootless Docker works; nothing needs root.
- Google Chrome, to trust the local certificate (see [Trusting the certificate](#trusting-the-certificate)).

Nothing else needs to be installed on the host: the frontend build, the backend, the database and the certificates are all handled inside containers.

### Setup

From the repository root, copy the example environment file:

```sh
cp .env.example .env
```

Then fill in these four variables in `.env`. They are empty in `.env.example`:

| Variable | What to put |
|---|---|
| `SECRET_KEY` | A long random string, for example the output of `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`. The backend refuses to start if it is empty. |
| `POSTGRES_PASSWORD` | A password of your choice for the database. Avoid `@`, `:` and `/`: they break `DATABASE_URL`. |
| `DATABASE_URL` | Replace `PASSWORD` with the same value as `POSTGRES_PASSWORD`. |
| `GRAFANA_ADMIN_PASSWORD` | A password for the Grafana admin login. Wrap it in single quotes if it contains `$`. |

The other variables are pre-filled and work as they are: `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `POSTGRES_DB`, `POSTGRES_USER` and `GRAFANA_ADMIN_USER`.

`GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` are both required: `docker compose` refuses to start the stack if either one is missing or empty.

`.env` is gitignored. Never commit it.

### Start

```sh
docker compose up --build
```

This is the subject's `docker-compose up --build`, written for Compose v2 (the v1 `docker-compose` command isn't installed on 42 machines).

The first start builds the images, generates the local certificates, applies the database migrations and starts every service. Then open **https://localhost:8443**.

- HTTPS only: there is no plain-HTTP port.
- Port 8443, not 443: Docker on 42 machines is rootless and can't publish ports below 1024.
- Until you trust the local certificate authority (next step), Chrome shows a certificate warning.

To stop, press `Ctrl+C`, or run `docker compose down` from another terminal. `docker compose down -v` also deletes the database, the uploads and the monitoring data.

### Trusting the certificate

On the first start, a one-shot `certgen` container creates a local certificate authority (CA) and a certificate for `localhost` signed by it. Trust the CA once in Chrome, and the site loads with a clean padlock and no warnings:

1. Start the stack once (see [Start](#start)) so that the CA exists at `infrastructure/certs/out/ca/rootCA.pem`.
2. In Chrome, open `chrome://certificate-manager`.
3. Go to **Local certificates** → **Installed by you** → **Trusted certificates** → **Import**.
4. Select `infrastructure/certs/out/ca/rootCA.pem` from this repository.
5. Reload https://localhost:8443.

Import it in the same Chrome profile you use for the evaluation.

A fresh clone generates a new CA, so after cloning again you must import the new `rootCA.pem` again. Later starts from the same clone reuse the existing CA.

The CA's private key, `rootCA-key.pem`, stays in `infrastructure/certs/out/ca/`, which is gitignored. It is never committed and never mounted into nginx.

### Monitoring

Grafana is at **https://localhost:8443/grafana/**. Log in with `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` from `.env`.

- The dashboard **Pawfect Match — Ops** (direct link: https://localhost:8443/grafana/d/pawfect-ops) shows:
  - backend up/down and firing alerts
  - request rate, responses by status class and latency
  - backend CPU and memory
  - host CPU, memory and disk
- Prometheus collects the metrics but is internal only. It has no published port, and nginx doesn't route to it. Use Grafana to see the data.

Grafana stores the admin password only on its very first start, when its data volume is created. Changing `GRAFANA_ADMIN_PASSWORD` in `.env` later has no effect. To change the password afterwards, run:

```sh
docker compose exec grafana grafana cli admin reset-admin-password <new-password>
```

**Alert demo**

1. Open the Ops dashboard.
2. Stop the backend: `docker compose stop backend`. The **Backend** panel switches to DOWN. The dashboard refreshes every 30 seconds.
3. About a minute later, **BackendDown** appears under **Firing alerts**, together with the time it became active. The rule waits 1 minute, and scraping and evaluation add up to 30 seconds.
4. Start the backend again: `docker compose start backend`. The alert clears shortly after the backend is back.

## Architecture: one backend process

The backend runs as **exactly one Daphne process**: no extra workers, no `docker compose up --scale backend=…`, no Redis, and no Celery or other task queue. Real-time messaging (the Channels in-memory channel layer), the online-presence registry and the public API's rate-limit counters all live in that one process's memory, so a second process would silently split them instead of failing.

## Individual Contributions

| Login | Key contributions |
|-------|------------------|
| sarherna | Backend domain model (accounts, pets, inquiries, adoption stages, notifications service); profile view (F7); technical architecture and initial project setup |
| akacprzy | Database schema design; SQLAlchemy analytics write pipeline (A2); django-prometheus instrumentation (A3); platform analytics endpoint (A4); per-user analytics endpoint (A5); friends backend (B3); friends view (F6); analytics dashboard frontend (F9) |
| faikhan | Docker, nginx and HTTPS setup (D1/D2); Prometheus and node-exporter (D3); Grafana dashboard and alerts (D4); WebSocket backend — JWT auth, presence, chat routing, pet subscriptions (B8); public API — keys, throttle, CRUD, OpenAPI docs (B9); SocketProvider frontend |
| oostapen | Frontend scaffold and API client (F0); auth flow frontend (F1); pet page (F3); animated logo, favicon and shell layout; design system components |
| iskaraag | Browse with filters and live updates (F2); rehome and publish flow (F4); adoptions view (F5); notification center and toast (F8); Modal, Toast, Tabs, Select, Chip, Progress design system components |

**Challenges**

**sarherna:** Planning: Bringing the project's requirements from the idea to an actual tangible system design and plan. And handling authentication: Got to read for a while and sit in focus to understand how does JWT authentication and cryptography work in this use case.

**akacprzy:** This project was the first time I wrote any frontend code. Before it, everything I'd done was backend or data. Learning it was like learning a whole new programming language.

<!-- TODO(faikhan): describe your biggest technical challenge -->

<!-- TODO(oostapen): describe your biggest technical challenge -->

<!-- TODO(iskaraag): describe your biggest technical challenge -->

## Resources

- [Django documentation](https://docs.djangoproject.com/en/5.2/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Django Channels](https://channels.readthedocs.io/)
- [SQLAlchemy 2.x](https://docs.sqlalchemy.org/en/20/)
- [React documentation](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Prometheus](https://prometheus.io/docs/) / [Grafana](https://grafana.com/docs/)

<!-- TODO(all): add references, tutorials or articles that shaped your implementation -->

## AI Usage

This project was developed with the assistance of AI tools.

<!-- TODO(all): each team member to describe which tools they used, what they generated, and what they wrote themselves -->

<!-- TODO(sarherna): describe your biggest technical challenge -->

**akacprzy:** Used AI tools throughout the project: to get up to speed on unfamiliar topics quickly, to review my own code before posting PRs and catch edge cases I might have missed, to draft documentation and KB notes which I then edited for accuracy and tone. Lastly, to get summaries of my teammates issued work to keep track of project proress and status and catch up quickly after breaks. 

<!-- TODO(faikhan): describe your biggest technical challenge -->

<!-- TODO(oostapen): describe your biggest technical challenge -->

<!-- TODO(iskaraag): describe your biggest technical challenge -->