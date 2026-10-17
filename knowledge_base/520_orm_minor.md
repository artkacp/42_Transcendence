# 520 — SQLAlchemy (ORM Minor — mandated)

SQLAlchemy is the team's chosen external ORM to satisfy the ORM Minor module requirement. The subject requires use of an external ORM library (not Django's built-in) — SQLAlchemy is what we are using to meet that. It owns the per-user analytics store end to end and is the entire persistence layer for the User activity analytics Minor module.

---

## Ownership boundary

| Layer | Owns |
|-------|------|
| Django ORM | Every domain table — users, pets, inquiries, messages, notifications, friendships. Also reads `analytics_event` for dashboard aggregations (read-only). |
| SQLAlchemy | `analytics_event` table only — owns the schema mapping and all writes; event ingest and `/api/analytics/me/` rollups. |

Django reads `analytics_event` for the Advanced analytics dashboard (direct aggregation queries). SQLAlchemy owns the mapping and all writes — Django never writes to it. Django's delete collector does not traverse the analytics table — the FK from `analytics_event.pet_id` to `pets` is nullable and set to `NULL` by the database on pet deletion (not CASCADE), so hard deletes work without SQLAlchemy being involved.

---

## Schema ownership

The `analytics_event` table is created by a hand-written `RunSQL` Django migration. SQLAlchemy maps the existing schema and **never calls `create_all()`**. This keeps `manage.py migrate` as the only migration command.

The app's `ready()` method compares SQLAlchemy's mapped columns against `information_schema` at startup and refuses to start if they diverge — the mapping cannot silently drift from the migration.

Alembic is not used. The project requirement ("use an ORM for the database") is satisfied by SQLAlchemy owning all reads and writes on the table. Schema management stays with Django's single migration tool. Decision confirmed 2026-09-27.

---

## SQLAlchemy setup

```python
# analytics/db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

engine = create_engine(settings.ANALYTICS_DB_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass
```

Sync `Engine` and `sessionmaker`. Consumers (WebSocket) reach it through `sync_to_async` — the same pattern they already use for Django ORM calls.

---

## analytics_event table

The event row captures a snapshot of the pet's features at the time of the action. This snapshot serves two purposes:
1. Stamps the Prometheus counter labels at increment time (platform analytics pipeline)
2. Preserves per-user history after a pet is hard-deleted (per-user analytics pipeline)

Key columns:
- `id` — UUID primary key
- `user_id` — who performed the action
- `pet_id` — nullable; set to NULL by DB on pet deletion
- `event_type` — `visit`, `application`, `message`, `adoption`, `listing_published`, `registered`
- `occurred_at` — timestamp
- `metadata` — JSONB snapshot: owner, role, and all 8 pet features (species, breed, age, size, sex, vaccinated, neutered, traits) at event time

---

## Write pattern

Analytics writes are deferred to `transaction.on_commit()` — they fire only after the domain transaction commits. This means:
- Accepted failure mode: a **missing event** if the process crashes between the domain commit and the analytics write
- Never: a phantom event for something that did not happen

The same `on_commit` hook also increments the Prometheus counters, so both pipelines are triggered from one place (TRD Flow E, decisions A-6 and A-7).

---

## Two connection pools

Running two ORMs against one database means two connection pools and two transaction scopes in one process. A request that touches both commits twice and cannot roll back atomically. The deferred-write pattern above is what makes this safe: analytics never writes inside a domain transaction.

---

## References

- TRD section 3, section 6.6 — per-user analytics design
- TRD decisions A-6, A-7 — event metadata and instrumentation point
- Note 510 — Django ORM (the other access layer)
- Note 530 — Data modeling (analytics_event schema details)
- Note Q-22 — resolved 2026-09-27: mapping-only confirmed, no Alembic required
