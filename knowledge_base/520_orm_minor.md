# 520 — ORM Minor (open decision #7)

Status: **open decision** — see note 010.

---

## What the minor requires

The ORM minor requires use of an **external ORM library** that is not Django's built-in ORM. Django's ORM alone does not qualify. The most common choice in the Python ecosystem is SQLAlchemy.

---

## SQLAlchemy

SQLAlchemy is the standard Python ORM outside of Django. It has two layers:

- **Core** — SQL expression language; query builder that stays close to SQL
- **ORM** — full object-relational mapping, similar to Django's ORM but more explicit

It connects to PostgreSQL via the same `psycopg2`/`psycopg3` adapter. It can share the same database as Django — they do not conflict at the DB level.

How it would sit alongside Django in this project:
- Django ORM handles migrations and most model interactions (we keep Django's migration system)
- SQLAlchemy is used for a defined subset — likely analytics queries or complex reporting, where its Core layer is a better fit than Django ORM's aggregation API

This means running two database connections (or connection pools) in the same process. Not a problem at this project's scale, but it adds configuration.

---

## Decision needed

Before committing to this minor:

1. Confirm with evaluators (or peers who have passed) that SQLAlchemy qualifies — the subject says "external ORM" but does not name a specific library.
2. Decide which part of the codebase uses SQLAlchemy — analytics is the natural candidate since it involves range aggregations and complex time-series queries.
3. Assess whether the complexity is worth 1 minor point given the team's familiarity with the library.

If we do not claim this minor, note 510 (Django ORM) is the only database access layer in use.
