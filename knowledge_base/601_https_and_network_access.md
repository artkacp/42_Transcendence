# 601 — HTTPS and Network Access Strategy

Resolves open decision #3 in note 010. Owner: faikhan.

---

## The problem

Note 002 requires every browser-to-backend connection to use HTTPS, with **zero warnings or errors in the browser console at any point**. Note 008 already flagged the core tension: a self-signed certificate triggers a browser warning, which is an automatic violation — and evaluators connect from their own separate machines, so we can't rely on them trusting a custom local CA.

Internal connections (backend↔db, container↔container) do not need HTTPS per note 002 — this only concerns the browser-facing edge.

---

## Options considered

| Approach | Verdict |
|---|---|
| `mkcert` self-signed | Rejected — requires installing a trusted CA on every evaluator's machine before they connect. Not something we can ask of them, and it's a manual step outside `.env` setup. |
| Real domain + Let's Encrypt | Works cleanly, no warnings, in any browser. Costs ~$10–15/year and requires DNS pointed at the VM. |
| `nip.io` / `sslip.io` + Let's Encrypt | Works cleanly, no warnings, **free**, no domain purchase. These services resolve `<ip-with-dashes>.nip.io` to the embedded IP automatically, and because it's a real publicly resolvable domain, Let's Encrypt will issue a genuine trusted certificate for it. |
| Campus convention | Unconfirmed — worth asking peers who've already passed in case the school has a standard answer that's simpler than any of the above. |

---

## Recommendation

**`nip.io` + Let's Encrypt, automated via Traefik as the reverse proxy.**

Reasoning:
- No cost, no domain registration step, no evaluator-side setup — someone just opens the URL and gets a valid padlock.
- Traefik handles TLS termination *and* automatic cert issuance/renewal in one container, which fits the "small set of containers, no microservices sprawl" approach from note 009 better than a separate nginx + certbot companion setup.
- Automatic renewal means we're not relying on a manual step later, which keeps us aligned with the "must run without manual file edits beyond `.env`" rule in note 002.

Fallback: if the VM doesn't have a stable public IP (see verification items below), switch to a real domain — same Traefik + Let's Encrypt setup, just point a DNS A record instead of relying on `nip.io`.

---

## Implementation checklist

- [ ] Confirm the VM has a **public, static IP** (nip.io breaks if the IP changes)
- [ ] Confirm **ports 80 and 443 are reachable from the internet** (needed for the ACME HTTP-01 challenge) — check campus firewall/NAT rules
- [ ] Add Traefik as a service in `docker-compose.yml`, configured for the ACME/Let's Encrypt provider
- [ ] Route `/api/*` and `wss://` (the single multiplexed socket, per TRD Flow A) to the **one** backend container, everything else to the frontend — there's exactly one backend replica by design (see the task plan's "single Daphne process" rule), so no load balancing to configure, just a clean proxy pass-through with WS-upgrade headers preserved
- [ ] Deploy, hit the `nip.io` URL from a machine that has never touched the VM before, confirm Chrome shows a clean padlock with zero console warnings
- [ ] Ask peers who've already passed about "campus convention" — if there's an established simpler pattern, note it here and reconsider

---

## Once resolved

Move item #3 from **Pending** to **Resolved** in note 010, with a one-line outcome and date, per the update convention in note 021.
