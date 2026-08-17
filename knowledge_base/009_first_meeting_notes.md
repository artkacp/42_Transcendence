# 009 — First Meeting Notes

Outcomes and decisions from the first kickstart meeting.

---

## Team

| Login | Area |
|-------|------|
| akacprzy | Data Engineering, database, API, analytics, ORM |
| sarherna | Technical Lead, initial PM |
| faikhan | DevOps, deployment, containers, backend, security |
| oostapen | Frontend, platform logic |
| iskaraag | Frontend |

Role decisions still open: PM and PO not yet formally assigned.

---

## What we are building

**Pet Adoption App**

- Not a microservices architecture
- One container or a small set of containers for necessary parts only

---

## Frontend options

Proposal from the team chat: **React + TypeScript + Vite + Tailwind CSS** — not yet formally confirmed.

| Option | Language | Build tool | Notes |
|--------|----------|------------|-------|
| React + TS + Vite | TypeScript | Vite | Most common in the 42 ecosystem. Large community, many examples. Fits well with a separate Django backend. |
| Vue 3 + TS + Vite | TypeScript | Vite | Lighter learning curve. Less common in 42 projects but valid. |
| Next.js | TypeScript | built-in | React-based with SSR. Would replace Django as backend — not compatible with both together. |
| Angular | TypeScript | Angular CLI | More structured, steeper learning curve. |

**Tailwind extra point — verify before claiming.** Someone mentioned Tailwind counts as an additional module point. The relevant module is "Custom design system" (Minor, 1 pt) — already on the confirmed list. Tailwind can be used to build that design system, but Tailwind itself does not earn a separate point. Confirm with peers who have passed before treating this as an additional module.

Frontend framework decision to be confirmed at next sync.

---

## Modules

### Confirmed (18 pts)

#### Web (11 pts)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Framework for frontend + backend | Major | 2 | Backend: Django. Frontend: TBD |
| User interaction (chat + profiles + friends) | Major | 2 | Basic chat, profile view, friends system |
| Public API (secured, rate-limited, 5+ endpoints) | Major | 2 | |
| Notification system | Minor | 1 | |
| Custom design system | Minor | 1 | Min. 10 reusable components, palette, typography, icons |
| Advanced search | Minor | 1 | Filters, sorting, pagination |
| File upload and management | Minor | 1 | |

#### User Management (3 pts)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Standard user management and authentication | Major | 2 | |
| User activity analytics and insights dashboard | Minor | 1 | |

#### DevOps (2 pts)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Monitoring — Prometheus + Grafana | Major | 2 | |

#### Data and Analytics (2 pts)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Advanced analytics dashboard | Major | 2 | |

---

### Under consideration (not committed)

| Module | Category | Type | Pts | Notes |
|--------|----------|------|-----|-------|
| Advanced permissions system | User Management | Major | 2 | |
| ORM for database | Web | Minor | 1 | Use external ORM (e.g. SQLAlchemy), separate from Django built-in |
| OAuth 2.0 remote authentication | User Management | Minor | 1 | Provider TBD |
| 2FA | User Management | Minor | 1 | Method TBD |
| Multiple languages (i18n) | Accessibility | Minor | 1 | Min. 3 translations |

---

### Point summary

| | Confirmed | If all additional | Max |
|-|-----------|-------------------|-----|
| Major pts | 14 | +2 | 16 |
| Minor pts | 4 | +5 | 9 |
| **Total** | **18** | **+7** | **25** |

Required to pass: **14 pts** — covered by confirmed modules alone.

---

## Tooling

- Task management: TBD — Notion or GitHub Issues under consideration
- Communication: Slack channel
- Meeting cadence: once per week or bi-weekly

---

## Other

- HTTPS certificate approach: to be verified with peers who have passed. Self-signed certificates cause browser warnings, which violates the "no warnings" requirement — needs a clean solution before evaluation.
- Initial design mockups available for reference.
