# 501 — PostgreSQL

The project requires PostgreSQL as the database. This note covers setup and basics.

---

## Why PostgreSQL

It's mandatory per the subject. Beyond that, PostgreSQL is a good fit: full ACID compliance, strong support for JSON and arrays as column types, and `pg_trgm` for efficient full-text search — all of which we need.

SQLite is not an option (doesn't survive Docker restarts well, single-writer, no `pg_trgm`).

**pg_trgm** is a PostgreSQL extension that enables fast similarity and pattern searches on text. It works by splitting text into overlapping 3-character chunks ("trigrams") and indexing them. This makes wildcard searches like `ILIKE '%labrador%'` efficient even on large tables — without it, those queries do a full table scan. Used for the pet search-by-name/breed feature.

---

## Running via Docker

PostgreSQL runs in a Docker container defined in `docker-compose.yml`. The container exposes port 5432 and persists data in a named volume so it survives restarts.

Minimal config needed in the compose file:

```yaml
postgres:
  image: postgres:16
  environment:
    POSTGRES_DB: pawfect
    POSTGRES_USER: pawfect
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  ports:
    - "5432:5432"
```

Credentials come from `.env` — never hardcoded. See note 022 for the `.env` sharing convention.

---

## Connecting from Django

Django's `DATABASES` setting in `settings.py`:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env("DB_PORT", default="5432"),
    }
}
```

`django-environ` or `python-decouple` are common choices for reading `.env` values. `psycopg2-binary` (or `psycopg[binary]` for psycopg3) is the Python adapter that Django uses to talk to PostgreSQL.

---

## Useful commands

```bash
# Connect to the running container
docker compose exec postgres psql -U pawfect

# Inside psql
\dt           -- list tables
\d tablename  -- describe a table
\q            -- quit
```

For a GUI, SQLTools in VS Code with the PostgreSQL driver works well without installing anything extra.
