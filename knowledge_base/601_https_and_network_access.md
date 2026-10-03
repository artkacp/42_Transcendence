# 601 — HTTPS and Network Access Strategy

Resolves open decision #3 in note 010. Owner: faikhan.

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

**nginx serves a certificate signed by a local certificate authority (CA) generated with `openssl` in a one-shot `certgen` container.**

- On `docker-compose up`, `certgen` creates a local CA (`rootCA.pem`, `rootCA-key.pem`) and a server certificate for `localhost` signed by that CA, then exits. Existing files are reused, so a browser that already trusts the CA keeps trusting it.
- `rootCA.pem` is imported once into the browser on the evaluation machine — one documented step in the README.
- nginx serves the server certificate on host port **8443** (`https://localhost:8443`). Because the browser trusts the CA, it trusts nginx's certificate: no warning, clean padlock.

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
- [ ] Generate the local CA and nginx certificate with `openssl` in a one-shot `certgen` container, covering `localhost` (the hostname used in the browser)
- [ ] Add `rootCA-key.pem` and the generated certificate files to `.gitignore`
- [ ] Configure nginx to serve the certificate for `/`, `/api/`, and `/ws/` (WebSocket upgrade)
- [ ] Document the one-time CA import (`rootCA.pem`) in the README
- [ ] On the evaluation machine and account: run `docker-compose up --build`, open `https://localhost:8443`, confirm a clean padlock and zero console warnings
