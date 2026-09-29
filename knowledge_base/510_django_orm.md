# 510 — Django ORM

Django's built-in ORM maps Python classes to database tables. This is how we interact with PostgreSQL in the backend.

---

## Models

Each model is a Python class that inherits from `django.db.models.Model`. Each attribute is a field that maps to a column.

```python
class Pet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    species = models.CharField(max_length=10, choices=[("dog", "Dog"), ("cat", "Cat")])
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="pets")
```

Common field types: `CharField`, `TextField`, `IntegerField`, `BooleanField`, `DateTimeField`, `UUIDField`, `ForeignKey`, `ManyToManyField`, `JSONField`, `ArrayField` (PostgreSQL-only).

---

## Migrations

Every model change (add field, rename, delete) requires a migration. Two steps:

```bash
python manage.py makemigrations   # generates migration file from model changes
python manage.py migrate          # applies pending migrations to the database
```

Migration files are committed to the repo. Never edit them manually after applying — make a new migration instead.

---

## QuerySets

QuerySets are lazy — they hit the database only when evaluated (iterated, converted to a list, sliced).

```python
# filter, exclude, order
Pet.objects.filter(species="dog").exclude(is_adopted=True).order_by("-created_at")

# get a single object (raises DoesNotExist if not found)
Pet.objects.get(id=some_uuid)

# aggregations
from django.db.models import Count
Pet.objects.values("species").annotate(count=Count("id"))
```

---

## Avoiding N+1 queries

Forgetting to prefetch related objects is the most common Django performance mistake. Use `select_related` for ForeignKey (JOIN) and `prefetch_related` for reverse relations and ManyToMany (separate query):

```python
# Bad: hits DB once per pet to get the owner
pets = Pet.objects.all()
for pet in pets:
    print(pet.owner.name)  # N extra queries

# Good
pets = Pet.objects.select_related("owner").all()
```

Django Debug Toolbar (or logging `django.db.backends`) shows all queries during a request — useful for spotting this during development.

---

## PostgreSQL-specific fields

These require `django.contrib.postgres` in `INSTALLED_APPS`:

| Field | Use case |
|-------|----------|
| `ArrayField` | Storing a list of values in one column (e.g. pet traits) |
| `JSONField` | Structured JSON (also available in base Django now) |
| `SearchVectorField` + `GinIndex` | Full-text search via `pg_trgm` |

---

## Raw SQL

Use `Model.objects.raw("SELECT ...")` or `connection.cursor()` for queries that are awkward to express with the ORM. Keep raw SQL in a dedicated method or manager, not scattered across view logic.
