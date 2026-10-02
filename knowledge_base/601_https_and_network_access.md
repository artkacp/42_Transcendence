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

This rules out Let's Encrypt (it must reach the machine from the public internet to issue a certificate, and a campus workstation is not reachable that way), and it makes a local certificate authority workable.

---

## Decision

**nginx serves a certificate signed by a local certificate authority (CA) created with `mkcert`.**

- `mkcert` creates a local CA and installs it into the trust store of the browser on the evaluation machine.
- `mkcert` then issues the certificate nginx serves, signed by that CA.
- Because the browser trusts the CA, it trusts nginx's certificate: no warning, clean padlock.

---

## Options considered

| Approach | Verdict |
|---|---|
| Local CA via `mkcert` | **Chosen.** Works because evaluation uses a browser on the same machine where the CA is installed. |
| Plain self-signed certificate | Rejected — browser warning on every visit, automatic violation of note 002. |
| `nip.io` / real domain + Let's Encrypt (HTTP challenge), via Traefik | Rejected — needs a public IP with ports 80/443 reachable from the internet; a 42 campus machine has neither. Traefik is also not our proxy (nginx, decision #12). This was the previous recommendation in this note. |
| Real domain + Let's Encrypt (DNS challenge) | Rejected — works without a public IP, but costs money, needs a DNS provider API key handled as a secret, and adds setup that can fail on evaluation day. |

---

## Rules

- The CA must be installed in the **same browser and user account** used during evaluation. A different account or a different machine brings the warning back.
- The CA private key (`rootCA-key.pem`) is **never committed**. Anyone holding it can create certificates the machine trusts. It stays out of the repo like `.env`.
- Installing the CA is **one documented command in the README** — the only manual setup step besides `.env` (note 002).

---

## Known risk

Decision #12 says nginx listens on port 443. On a 42 machine, binding ports below 1024 may require root. If 443 cannot be bound, a higher port (for example 8443) is the fallback, and decision #12 must be updated to match.

---

## Implementation checklist

- [ ] Confirm whether port 443 can be bound on the evaluation machine
- [ ] Generate the local CA and nginx certificate with `mkcert`, covering the hostname used in the browser
- [ ] Add `rootCA-key.pem` and the generated certificate files to `.gitignore`
- [ ] Configure nginx to serve the certificate for `/`, `/api/`, and `/ws/` (WebSocket upgrade)
- [ ] Document the CA install command in the README
- [ ] On the evaluation machine and account: run `docker-compose up --build`, open the site, confirm a clean padlock and zero console warnings
