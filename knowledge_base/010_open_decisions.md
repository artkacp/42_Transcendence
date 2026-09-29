# 010 — Open Decisions

Decisions that have been identified but not yet resolved. Update this note when a decision is made — move the item out of the table and note the outcome in the relevant note.

Reference: full detail on every decision and open question is in the TRD — https://proto-pet-adoption.vercel.app/requirements (section 7).

---

## Pending

| # | Topic | Context | Owner |
|---|-------|---------|-------|
| 1 | Design system approach | shadcn/ui vs. custom-made components. Frontend team (oostapen, iskaraag) is building components from scratch on custom OKLCH tokens (9 components merged as of 2026-09-13). sarherna has suggested shadcn is valid if themed through Tailwind. Module title is "Custom-made design system with reusable components" — authorship question applies at defence. No explicit team decision made. | All |
| 2 | PM and PO roles | Not yet formally assigned. sarherna acting as initial PM. | All |
| 3 | HTTPS approach | Self-signed certs cause browser warnings. Need a clean solution before evaluation. Options: mkcert, real domain, campus convention. Verify with peers who have passed. | faikhan |
| 4 | Tailwind extra point | Depends on resolution of #1 — if shadcn/ui does not satisfy "Custom-made design system", Tailwind alone does not earn a separate point either. Hold until #1 is resolved. | All |
| 5 | OAuth provider | OAuth 2.0 module is under consideration. Provider not yet decided (Google, GitHub, 42 intranet, etc.). | TBD |
| 6 | 2FA method | 2FA module is under consideration. Method not decided (TOTP app, SMS, email OTP, etc.). | TBD |
| 8 | Additional modules | Advanced permissions, OAuth, 2FA, i18n are under consideration but not committed. | All |
| 10 | Branch naming convention | Defined in note 022. Confirm the team has read and agreed. | All |

### Open questions from TRD v3.0 (block specific tasks)

These are unresolved design questions from the TRD. Full context in TRD section 7.2.

| Q | Question | Blocks |
|---|----------|--------|
| Q-19 | Where friend requests surface in the UI | F6 (Friends view UI). Backend task B3 can proceed without this. |
| Q-20 | Per-user metrics: which metrics, rendered where, visible to whom | A5 (SQLAlchemy store & /analytics/me/) |
| Q-23 | Definitions of active / seeker / rehomer and sign-ups under a feature slice | A3 (Prometheus metrics), A4 (dashboard endpoint) |
| Q-25 | Sign-off on distinct-count adaptations under Prometheus. Unique visitors, DAU, and seekers/rehomers come from in-process per-day sets exposed as gauges (Prometheus cannot deduplicate people). These reset on process restart and are not backfilled. Unique visitors are not sliceable by pet feature. | A3, A4 |

---

## Resolved

| # | Topic | Outcome | Date |
|---|-------|---------|------|
| 7 | ORM library | **SQLAlchemy 2.0 — mandated.** Owns the `analytics_event` table in PostgreSQL exclusively. Django ORM owns every other table and never touches it. Schema created by a hand-written `RunSQL` Django migration; SQLAlchemy maps it without emitting DDL. See note 520. | 2026-09-01 |
| 9 | Task management tool | **Notion.** Implementation plan and task assignments are managed there. Each task has scope, requirement references, and acceptance criteria. | 2026-09-03 |
| 11 | Frontend framework | **React 19 + TypeScript + Vite + Tailwind v4.** Confirmed by merged `feat/frontend-scaffold`. Design system approach (shadcn vs. custom) is tracked separately as open decision #1. | 2026-09-12 |
| 12 | Routing and CORS | **nginx as reverse proxy, single origin, port 443 only.** Browser connects to nginx; nginx routes `/` to frontend static files, `/api/` to Django, `/ws/` to Django (WebSocket upgrade). No CORS configuration needed. Backend port not exposed. Confirmed by faikhan and oostapen in Slack. | 2026-09-12 |
| Q-22 | ORM schema ownership | **Mapping-only — confirmed.** Django creates the `analytics_event` table via a hand-written `RunSQL` migration. SQLAlchemy maps the existing table and owns all reads and writes; it never calls `create_all()` or uses Alembic. Single migration tool (`manage.py migrate`), cleaner Docker startup. Subject requirement ("use an ORM for the database") is fully satisfied. See note 520. | 2026-09-27 |
