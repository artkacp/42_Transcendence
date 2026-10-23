# 601 — HTTPS and Network Access Strategy

Resolves open decision #3 in note 010 and implements decision #12. Owner: faikhan.

---

## The problem

Note 002 requires every browser-to-backend connection to use HTTPS, with **zero warnings or errors in the browser console at any point**. A plain self-signed certificate triggers a browser warning, which is an automatic violation.

Internal connections (backend↔db, container↔container) do not need HTTPS per note 002 — this only concerns the browser-facing edge, which is nginx (note 010, decision #12).

---

## Where the app runs

- The app runs on a **42 campus machine** with Docker Compose, not on a VM.
- Evaluation happens in a **browser on that same machine**.
- There is **no root access**, and Docker is **rootless**: host ports below 1024 cannot be published, and `mkcert` and `certutil` cannot be installed.

This rules out Let's Encrypt (it must reach the machine from the public internet to issue a certificate, and a campus workstation is not reachable that way), and it makes a local certificate authority workable.

---

## Decision

**nginx is the only entry point, on host port 8443. It serves a certificate signed by a local certificate authority (CA) that a one-shot `certgen` container generates with `openssl`.**

- `certgen` (`infrastructure/certs/`: Alpine + openssl, script `generate.sh`) runs on every `docker compose up` and exits. nginx waits until it has completed successfully. It writes to `infrastructure/certs/out/`, which is bind-mounted and gitignored:
  - `ca/rootCA.pem` and `ca/rootCA-key.pem`: the local CA, RSA 4096, valid 10 years.
  - `server/fullchain.pem` and `server/privkey.pem`: the server certificate, RSA 2048, valid 365 days, for `DNS:localhost` and `IP:127.0.0.1`.
- Existing files are reused:
  - If the server certificate exists, `certgen` does nothing.
  - If only the server certificate is missing, it is re-signed with the existing CA.
  - So a browser that trusts the CA keeps trusting it for as long as the same clone is used.
  - A fresh clone has no `out/` directory, so it gets a new CA, which must be imported again.
- nginx mounts only `out/server/`, read-only. The CA key never reaches it.
- `rootCA.pem` is imported into the evaluation browser (see [Browser import](#browser-import-chrome)). This is the only manual step besides `.env`, and it is documented in the README under "Trusting the certificate".

---

## Routing (single origin)

Everything is served from one origin, `https://localhost:8443`. The browser never makes a cross-origin request, so there is no CORS configuration (decision #12). Config: `infrastructure/nginx/default.conf`.

| Path | Goes to | Notes |
|---|---|---|
| `/` | Built frontend, served by nginx itself | Unknown paths fall back to `index.html` for client-side routing. |
| `/api/` | Backend, `backend:8000` (the one Daphne process) | |
| `/ws/` | Backend, `backend:8000` | WebSocket upgrade, with a 1 h read timeout so idle sockets stay open. Contract: note 430. |
| `/grafana/` | Grafana, `grafana:3000` | The path is passed through unchanged, because Grafana serves from the sub-path. WebSocket upgrade for Grafana Live. `/grafana` redirects to `/grafana/` and keeps `:8443`. |
| `/media/avatars/`, `/media/pets/` | Files from the `media` volume, read-only | Any other `/media/` path returns 404. Attachments are served only by the permission-checked Django view. |

nginx resolves `backend` and `grafana` when it starts, and exits if either is missing. That is why it `depends_on` both.

---

## Published ports

Only nginx is published: host **8443** → container 443. There is no plain-HTTP port.

The following are **not published** in the evaluation run:
- backend (8000)
- PostgreSQL (5432)
- Prometheus (9090)
- Grafana (3000)
- node-exporter (9100)

They are reachable only on the Compose network. nginx doesn't route to Prometheus either; Grafana queries it internally.

The dev overlay (`docker-compose.dev.yml`) also publishes the backend on 8000 and PostgreSQL on 5432. This is for development only, never for the evaluation run.

---

## Browser import (Chrome)

1. Start the stack once so that `infrastructure/certs/out/ca/rootCA.pem` exists.
2. In Chrome, open `chrome://certificate-manager` and go to **Local certificates** → **Installed by you** → **Trusted certificates** → **Import**. Select `rootCA.pem`.
3. Reload `https://localhost:8443`. The padlock should be clean.

The import applies to that browser profile only. Repeat it after a fresh clone, because the clone gets a new CA.

---

## Options considered

| Approach | Verdict |
|---|---|
| Local CA generated with `openssl` in a one-shot container | **Chosen.** Needs nothing installed on the host beyond Docker. Works because evaluation uses a browser on the same machine where the CA is imported. |
| Local CA via `mkcert` | Rejected — `mkcert -install` needs root or `certutil` to trust the CA, and neither is available on 42 machines. This was the previous choice in this note. |
| Plain self-signed certificate | Rejected — browser warning on every visit, automatic violation of note 002. |
| `nip.io` / real domain + Let's Encrypt (HTTP challenge), via Traefik | Rejected — needs a public IP with ports 80/443 reachable from the internet; a 42 campus machine has neither. Traefik is also not our proxy (nginx, decision #12). This was the previous recommendation in this note. |
| Real domain + Let's Encrypt (DNS challenge) | Rejected — works without a public IP, but costs money, needs a DNS provider API key handled as a secret, and adds setup that can fail on evaluation day. |

---

## Rules

- The CA must be imported in the **same browser and user account** used during evaluation. A different account or a different machine brings the warning back.
- The CA private key (`rootCA-key.pem`) is **never committed** and **never mounted into nginx** — nginx gets only the server certificate and its key. Anyone holding the CA key can create certificates the browser trusts. It stays out of the repo like `.env`.
- Importing the CA is **one documented step in the README** — the only manual setup step besides `.env` (note 002).

---

## Port

Decision #12 originally said nginx listens on port 443. Tested 2026-10-03 on a 42 machine: Docker is rootless, and publishing host port 443 fails (`cannot expose privileged port 443 ... bind: permission denied`). nginx is published on host port **8443** instead (it still listens on 443 inside the container), and decision #12 is updated to match.

---

## Implementation checklist

- [x] Confirm whether port 443 can be bound on the evaluation machine — it can't (rootless Docker, tested 2026-10-03); host port 8443 is used
- [x] Generate the local CA and nginx certificate with `openssl` in a one-shot `certgen` container, covering `localhost` (and `127.0.0.1`)
- [x] Add `rootCA-key.pem` and the generated certificate files to `.gitignore` (`*.pem`, `infrastructure/certs/out/`)
- [x] Configure nginx to serve the certificate for `/`, `/api/`, `/ws/` (WebSocket upgrade) and `/grafana/`
- [x] Document the one-time CA import (`rootCA.pem`) in the README
- [ ] On the evaluation machine and account: run `docker compose up --build`, open `https://localhost:8443`, confirm a clean padlock and zero console warnings

---

2026-10-20: Updated to what's built:
- `certgen` details
- the routing table, including `/grafana/` and `/media/`
- the published ports
- the Chrome import steps and the re-import needed after a fresh clone
- the implementation checklist, with built items ticked
