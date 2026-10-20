*This project has been created as part of the 42 curriculum by faikhan, oostapen, sarherna, <isshak-login>, <artur-login>.*

# Pawfect Match

A peer-to-peer adoption platform for dogs and cats: people rehoming a pet list it, and people looking to adopt browse the listings and talk to the owner directly.

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
