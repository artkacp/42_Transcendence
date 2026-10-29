# 530 — Data Modeling & Indexing

Principles and PostgreSQL patterns for the database layer. Schema specifics are tracked in the TRD (still evolving) — this note covers the reasoning and tools.

---

## UUID primary keys

All tables use UUID as the primary key (`uuid_generate_v4()` or Python's `uuid.uuid4`). Reasons:

- Safe to generate client-side or application-side without a DB round-trip
- No sequential enumeration — you cannot guess `/pets/3` to scrape records
- Works cleanly across distributed systems if we ever need it

In Django: `UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`.

Tradeoff: UUIDs are larger than integers and make btree indexes slightly less efficient due to random insertion order. For this project's scale it is not an issue.

---

## Indexes

Indexes speed up lookups but slow down writes and take disk space. Add them where queries are known and frequent, not preemptively everywhere.

| Index type | When to use |
|------------|-------------|
| **btree** (default) | Equality and range lookups on a column (`WHERE created_at > ...`, `ORDER BY created_at DESC`) |
| **GIN + pg_trgm** | Full-text search with `ILIKE` or `SIMILAR TO` on a text column |
| **GIN on ArrayField** | Lookups inside an array column (`traits @> ARRAY['friendly']`) |
| **Composite btree** | Filtering on multiple columns together (`WHERE species = 'dog' AND city = 'Warsaw'`) |

In Django, indexes are declared on the model's `Meta.indexes` list:

```python
class Meta:
    indexes = [
        models.Index(fields=["-created_at"]),
        GinIndex(fields=["search_text"]),  # from django.contrib.postgres.indexes
    ]
```

---

## Constraints

Use database constraints rather than (or in addition to) application-level validation. The DB is the last line of defense.

```python
class Meta:
    constraints = [
        models.CheckConstraint(
            condition=models.Q(age_years__gte=0) & models.Q(age_years__lte=40),
            name="pet_age_valid_range",
        ),
    ]
```

Common types: `CheckConstraint` (value range, string length), `UniqueConstraint` (unique together on multiple columns), `ForeignKey` with `on_delete` (CASCADE, SET_NULL, PROTECT).

---

## JSON and JSONB

PostgreSQL's `JSONB` column stores semi-structured data efficiently and supports indexing. Django's `JSONField` maps to it. Useful for event metadata where the shape varies by event type — rather than adding columns for every possible attribute, store the variable part in JSONB.

Do not overuse it: for data you filter or join on regularly, a proper column with a btree index is faster and clearer.

---

## Soft deletes vs. hard deletes

Hard deletes (actual `DELETE`) are confirmed. If a pet is deleted, cascading FKs clean up inquiries and messages. The one exception is `analytics_event.pet_id` — that FK is **nullable with SET NULL** (not CASCADE), so analytics history survives pet deletion. The feature snapshot in `analytics_event.metadata` (JSONB) preserves the pet's attributes at event time, so per-user history remains correct even after the pet row is gone.

---

## analytics_event — SQLAlchemy-owned table

This table is **not** managed by Django ORM. It is created by a hand-written `RunSQL` Django migration and mapped by SQLAlchemy. Django never reads or writes it.

The `metadata` JSONB column stores a snapshot of the pet's 8 features at event time (species, breed, age, size, sex, vaccinated, neutered, traits). This snapshot serves two pipelines:
- **Prometheus** — the same values stamp the counter labels at increment time
- **SQLAlchemy / per-user analytics** — the values persist after the pet is deleted

See note 520 for the full SQLAlchemy setup and write pattern.
