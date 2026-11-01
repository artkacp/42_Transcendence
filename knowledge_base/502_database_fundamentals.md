# 502 — Database Fundamentals

How relational databases work, and how Pawfect Match uses PostgreSQL through Django ORM and SQLAlchemy. Background for anyone less familiar with databases.

---

## What a relational database is

A relational database stores data in **tables**. Each table is like a spreadsheet: it has named columns and a row for each record. Every row in a table has a **primary key** — a unique identifier (usually an integer or a UUID) that no other row in that table shares.

Tables relate to each other through **foreign keys**. A foreign key is a column in one table that holds the primary key of a row in another table. For example, a `pets` row has a `user_id` column that points to the `id` column in the `users` table — this expresses "this pet belongs to that user".

```
users                        pets
-----                        ----
id (PK)  email  full_name    id (PK)  name  user_id (FK → users.id)
1        a@b    Alice         10       Max    1
2        c@d    Bob           11       Luna   2
```

Constraints enforce data integrity. A `NOT NULL` constraint means the column must always have a value. A `UNIQUE` constraint means no two rows can have the same value in that column. A foreign key constraint means the referenced row must exist — you can't create a pet pointing at a user that doesn't exist.

---

## Our tables

The schema is defined in Django models (all apps except analytics) and one SQLAlchemy mapping (analytics). A full entity-relationship overview is in note 530.

Key tables:
- `accounts_user` — users (AbstractUser; email is the login field)
- `accounts_friendship` — friend relationships (requester_id + addressee_id FKs to users)
- `pets_pet` — pet listings (owner_id FK to users)
- `inquiries_inquiry` — adoption applications (pet_id + applicant_id FKs)
- `inquiries_adoptionstage` — step-by-step adoption pipeline stages (inquiry_id FK)
- `notifications_notification` — in-app notifications (recipient_id FK to users)
- `analytics_event` — event log (user_id FK to users, pet_id FK to pets; nullable)

---

## How Django ORM maps to the database

Django **models** are Python classes. Each model class maps to one table. Each field on the class maps to one column. Django generates the `CREATE TABLE` SQL automatically through **migrations**.

```python
class Pet(models.Model):
    name = models.CharField(max_length=100)   # → name VARCHAR(100) NOT NULL
    owner = models.ForeignKey(User, on_delete=models.CASCADE)  # → owner_id BIGINT FK
```

Django creates migrations with `python manage.py makemigrations` and applies them with `python manage.py migrate`. Migrations are Python files in each app's `migrations/` folder — commit them alongside the model changes that produced them.

**QuerySets** are how you query the database from Python:

```python
Pet.objects.filter(species='dog').order_by('-created_at')
```

This produces SQL like `SELECT * FROM pets_pet WHERE species = 'dog' ORDER BY created_at DESC`. A QuerySet is lazy — it doesn't hit the database until you iterate over it, call `.first()`, `.count()`, `.list()`, etc.

---

## How SQLAlchemy fits in

The `analytics_event` table is an exception: Django creates the table via a raw `RunSQL` migration, but all writes go through **SQLAlchemy 2.0**.

SQLAlchemy owns the write path: when an event fires (user viewed a pet, sent a message, etc.), a SQLAlchemy session opens, writes the row, and commits. Django ORM reads the same table for the analytics dashboard aggregations — it treats it as a regular model mapped to the existing table (no migrations, just a `managed = False` class).

This split is intentional: see note 520 for the rationale. The SQLAlchemy engine is in `backend/analytics/db/engine.py`.

---

## Inspecting the database directly

Connect to the running database container:

```bash
docker compose exec db psql -U pawfect -d pawfect
```

Useful psql commands:
```sql
\dt                 -- list all tables
\d pets_pet         -- describe columns and indexes on the pets table
SELECT * FROM pets_pet LIMIT 5;
```

For a GUI, the SQLTools extension in VS Code works well with the PostgreSQL driver.

---

## Further reading

- Note 501 — PostgreSQL setup and Docker config
- Note 510 — Django ORM in depth
- Note 520 — ORM minor: SQLAlchemy rationale and implementation
- Note 530 — Data modeling: full schema diagram and field reference
