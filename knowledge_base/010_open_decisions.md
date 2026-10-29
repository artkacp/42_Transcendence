# 010 — Open Decisions

Decisions that have been identified but not yet resolved. Update this note when a decision is made — move the item out of the table and note the outcome in the relevant note.

Reference: full detail on every decision and open question is in the TRD — https://proto-pet-adoption.vercel.app/requirements (section 7).

---

## Pending

| # | Topic | Context | Owner |
|---|-------|---------|-------|
| 2 | PM and PO roles | Not yet formally assigned. sarherna acting as initial PM. | All |

---

## Resolved

| # | Topic | Outcome | Date |
|---|-------|---------|------|
| 3 | HTTPS approach | **Local CA generated with openssl in a container.** App runs on a 42 campus machine (not a VM) and evaluation uses a browser on that same machine. A one-shot `certgen` container creates a local CA and a server certificate for localhost; nginx serves the certificate. The CA (`rootCA.pem`) is imported once into the evaluation browser — one documented step in the README — so no browser warning appears. The CA private key (`rootCA-key.pem`) is never committed and never mounted into nginx. mkcert was dropped: installing its CA needs root or certutil, neither available on 42 machines. Traefik + Let's Encrypt dropped (needs a public IP). See note 601. | 2026-10-03 |
| 7 | ORM library | **SQLAlchemy 2.0 — mandated.** Owns the `analytics_event` table in PostgreSQL exclusively. Django ORM owns every other table and never touches it. Schema created by a hand-written `RunSQL` Django migration; SQLAlchemy maps it without emitting DDL. See note 520. | 2026-09-01 |
| 9 | Task management tool | **Notion.** Implementation plan and task assignments are managed there. Each task has scope, requirement references, and acceptance criteria. | 2026-09-03 |
| 11 | Frontend framework | **React 19 + TypeScript + Vite + Tailwind v4.** Confirmed by merged `feat/frontend-scaffold`. Design system approach (shadcn vs. custom) is tracked separately as open decision #1. | 2026-09-12 |
| 12 | Routing and CORS | **nginx as reverse proxy, single origin, port 8443 only (443 needs root; Docker is rootless on 42 machines — tested 2026-10-03).** Browser connects to nginx; nginx routes `/` to frontend static files, `/api/` to Django, `/ws/` to Django (WebSocket upgrade). No CORS configuration needed. Backend port not exposed. Confirmed by faikhan and oostapen in Slack. | 2026-09-12 |
| Q-22 | ORM schema ownership | **Mapping-only — confirmed.** Django creates the `analytics_event` table via a hand-written `RunSQL` migration. SQLAlchemy maps the existing table and owns all reads and writes; it never calls `create_all()` or uses Alembic. Single migration tool (`manage.py migrate`), cleaner Docker startup. Subject requirement ("use an ORM for the database") is fully satisfied. See note 520. | 2026-09-27 |
| Q-20 | Per-user analytics endpoint | **Private, all-time, single endpoint.** `/analytics/me/` returns the authenticated user's own stats only — no cross-user visibility. Two sections in one response: seeker stats (pets viewed, applications sent, adoptions completed) and rehomer stats (listings published, views received, inquiries received, pets adopted out). All-time totals; date filtering is handled by the platform dashboard. See note 421. | 2026-09-27 |
| Q-25 | Distinct-count adaptations | **Dissolved.** The Advanced analytics dashboard reads PostgreSQL directly via Django aggregation — SQL handles `COUNT DISTINCT` natively. The Prometheus-based distinct-count workaround (in-process per-day sets) is no longer needed. | 2026-10-11 |
| Q-26 | Analytics event table read ownership | **Django reads, SQLAlchemy writes.** The Advanced analytics dashboard queries `analytics_event` directly via Django ORM (read-only). SQLAlchemy still owns the table's schema mapping and all writes. The strict "two layers never cross" rule from decision #7 is relaxed to this boundary. See note 520. | 2026-10-11 |
| 1 | Design system approach | **shadcn/ui — approved.** TRD v4.0 confirms shadcn/ui as the platform design system; all UI is built on standard shadcn components with the platform palette (terracotta/cream/sage/honey) mapped onto shadcn semantic tokens. Decision #4 (Tailwind extra point) is void — shadcn satisfies the design system module requirement. | 2026-10-11 |
| Q-23 | Dashboard metric definitions | **Active = any event; seeker = visit event; rehomer = listing_published event — all within the selected period.** A user can be counted as both seeker and rehomer on the same day (not mutually exclusive). See note 422. | 2026-10-17 |
| 5, 6, 8 | Additional modules (OAuth, 2FA, Advanced permissions, i18n) | **Dropped.** ORM Minor and Real-time Features Major confirmed (both already implemented). OAuth, 2FA, Advanced permissions, and i18n will not be pursued. Confirmed module total: 20 pts. | 2026-10-29 |
| 10 | Branch naming convention | **Adopted in practice.** Convention defined in note 022 and used consistently throughout the project. | 2026-10-29 |
| Q-19 | Where friend requests surface in the UI | **Requests tab in the Friends view** (`?view=friends`, PR #81) + **add/accept button on other users' profile pages** (PR #76, F7). | 2026-10-29 |
