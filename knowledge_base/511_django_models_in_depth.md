# 511 — Django Models In Depth

A walkthrough of the `accounts` app models and their migration, explaining the patterns used. Complements note 510 (ORM basics), which covers QuerySets and field types.

---

## The custom User model

Django ships with a built-in `User` model that uses a username as the login field. This project uses email instead, which requires a custom model. The standard approach is to combine two base classes:

```python
class User(AbstractBaseUser, PermissionsMixin):
```

**`AbstractBaseUser`** provides the bare minimum: a hashed `password` field, a `last_login` field, and the `set_password()` / `check_password()` methods. It does not give you a username or email field — you define the login field yourself.

**`PermissionsMixin`** adds `is_superuser`, `groups`, and `user_permissions`. These hook into Django's permission system and the admin interface.

### Telling Django which field is the login identifier

```python
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']
    objects = UserManager()
```

`USERNAME_FIELD` replaces `username` with `email` everywhere Django expects a login identifier: `authenticate()`, the admin login form, and `manage.py createsuperuser`. `REQUIRED_FIELDS` lists which fields `createsuperuser` prompts for in addition to the login field and password.

`objects = UserManager()` attaches a custom manager. This is required because `AbstractBaseUser` does not know how to create a user without a username — you have to teach it.

---

## The UserManager

```python
class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email).lower()
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
```

`self.normalize_email(email)` is inherited from `BaseUserManager` and lowercases the domain part of the address (after `@`). The additional `.lower()` lowercases the local part too, so `Alice@Example.com` and `alice@example.com` are treated as the same address before the uniqueness check.

`self.model(...)` creates an unsaved instance. `self.model` is the class this manager is attached to — `User`.

`user.set_password(password)` hashes the password using Django's configured hasher (PBKDF2 by default) and stores the hash. Plaintext is never stored. Passing `password=None` marks the account unusable — the user cannot log in with a password, which is the right state for an OAuth-only account.

`user.save(using=self._db)` writes to the database. The `using=self._db` argument ensures it uses the correct connection if multiple databases are configured.

`create_superuser` just calls `create_user` with `is_staff=True` and `is_superuser=True` added. `setdefault` only sets them if not already provided.

---

## User fields

### UUID primary key

```python
id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
```

`primary_key=True` tells Django this is the table's PK and suppresses the auto-added integer `id` column that models normally get.

`default=uuid.uuid4` — note the absence of parentheses. This is a reference to the function, not a call. Django calls it once per new row, so each user gets a distinct UUID. Writing `uuid.uuid4()` (with parentheses) would evaluate it once when the class is defined and every row would get the same value — a common mistake.

`editable=False` hides the field from admin forms and DRF serializer defaults. The value is still readable and writable in Python, it just does not appear in generated forms.

### `null` vs `blank`

```python
city = models.CharField(max_length=100, null=True, blank=True)
bio = models.TextField(blank=True)
avatar = models.FileField(upload_to='avatars/', null=True, blank=True)
```

These two flags control different layers:

- `null=True` — the PostgreSQL column allows `NULL`. Without it, the column is `NOT NULL` and the database rejects rows where the value is absent.
- `blank=True` — Django's form and serializer validation accepts an empty value. Without it, validation fails even if the database would accept it.

For an optional field you usually need both. `bio` is an exception: it allows an empty string but not `NULL`, so `blank=True` alone is enough — the database stores `""` rather than `NULL`.

### Timestamps

```python
last_seen_at = models.DateTimeField(null=True, blank=True)
date_joined = models.DateTimeField(auto_now_add=True)
```

`auto_now_add=True` sets the column to `NOW()` when the row is first created and never updates it again. It cannot be set manually — the field is excluded from forms and `update_fields`. Use it for creation timestamps.

`last_seen_at` is nullable because it is set by the WebSocket consumer on first connection. A newly registered user has no value yet.

### FileField

```python
avatar = models.FileField(upload_to='avatars/', null=True, blank=True)
```

`FileField` writes the uploaded file to disk under `MEDIA_ROOT/avatars/` and stores only the relative path in the database column — something like `avatars/abc123.jpg`. The actual bytes live on disk; the column is just a path. `null=True` means the column can be empty for users who have not uploaded an avatar.

---

## Friendship model

### Two ForeignKeys to the same model

```python
requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
addressee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
```

`on_delete=models.CASCADE` tells PostgreSQL to delete this Friendship row when the referenced User is deleted. The alternative used elsewhere in the schema is `SET_NULL` (nullify the FK column instead of deleting the row), used where history should survive the deletion.

`related_name` defines the reverse accessor on the `User` model. Without it, Django auto-generates one as `friendship_set`, which is ambiguous when there are two FKs pointing at the same model. With distinct `related_name` values, you can write:

```python
user.sent_requests.all()     # all Friendship rows where this user is the requester
user.received_requests.all() # all Friendship rows where this user is the addressee
```

When two FKs point at the same model, distinct `related_name` values are required — Django raises a startup error otherwise.

### Constraints

```python
class Meta:
    constraints = [
        models.UniqueConstraint(
            Least('requester', 'addressee'),
            Greatest('requester', 'addressee'),
            name='unique_friendship_unordered_pair',
        ),
        models.CheckConstraint(
            check=~Q(requester=F('addressee')),
            name='no_self_friendship',
        ),
    ]
```

`unique_friendship_unordered_pair` allows one row per pair of users, whichever direction the request went. A friendship belongs to the pair, so A→B and B→A must not exist side by side: with two rows, accepting one leaves the other pending, and the profile endpoint cannot tell which row describes the relationship.

Instead of a list of fields, the constraint takes two expressions. `Least` and `Greatest` (from `django.db.models.functions`) map to PostgreSQL's `LEAST()` and `GREATEST()`, which also work on UUIDs. For a given pair they return the same two values in the same order no matter who the requester is, so A→B and B→A produce the same key and the second insert fails. PostgreSQL implements an expression constraint as a unique index on those expressions (`CREATE UNIQUE INDEX ... (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))`). It also blocks same-direction duplicates, so no separate `fields=['requester', 'addressee']` constraint is needed.

The constraint is what keeps this correct under concurrency. The view looks for an existing row first so it can return a clear 400, but two requests arriving at the same moment can both pass that check. The database then rejects the second insert with `IntegrityError`, and the view resolves it against the row that won: it accepts it if it is the other user's pending request, otherwise it returns 400.

The first version of the model used a directional `UniqueConstraint(fields=['requester', 'addressee'])`, which treated A→B and B→A as different pairs. Migration `accounts/0005_friendship_unordered_pair` replaced it. Before adding the new constraint, it deletes reverse duplicates that already exist (per pair it keeps the accepted row, otherwise the oldest), because PostgreSQL refuses to create a unique index over rows that already violate it.

`CheckConstraint` adds a `CHECK(...)` clause to the table definition. The condition `~Q(requester=F('addressee'))` translates to `CHECK (NOT (requester_id = addressee_id))`.

- `Q(...)` is a query object — the same syntax used in `.filter()` calls.
- `~Q(...)` negates it.
- `F('addressee')` is a reference to the value of the `addressee` column in the same row, evaluated by PostgreSQL in SQL rather than fetched into Python first. Using `F()` here means the comparison happens entirely in the database at write time.

Without this constraint, a user could create a friend request pointing at themselves.

---

## The migration

### What a migration is and why it exists

You write your model in Python — that describes what a User looks like in application code. But PostgreSQL does not read Python. It needs an explicit instruction: create a table with these columns, these types, these constraints. The migration is that instruction, in a format Django can execute.

When someone runs `manage.py migrate`, Django reads the migration files and runs their operations — in this case it executes the `CREATE TABLE` SQL for User and Friendship. Once done, it records in a `django_migrations` table that `accounts/0001_initial` has been applied and never runs it again.

The reason this is a separate file rather than something Django does automatically is control. Once the app is running with real data, you cannot silently alter tables — you need a migration that says "add this column" or "rename that index", deployed at the right moment. Migrations are the versioned record of every schema change, committed to git and applied in order on every environment.

Each Django app owns its own migration files. Accounts owns `accounts_user` and `accounts_friendship`, so it has `accounts/migrations/0001_initial.py`. Pets has a separate one for `pets_pet`. They connect via `dependencies` when one app's table has a foreign key into another app's table.

### Anatomy

The migration file records the schema change as a Python class. `manage.py migrate` executes the operations in sequence and marks them as applied in the `django_migrations` table.

### Dependencies

```python
dependencies = [
    ("auth", "0012_alter_user_first_name_max_length"),
]
```

`PermissionsMixin` adds `groups` and `user_permissions` FK columns that point at `auth.Group` and `auth.Permission`. Those tables come from Django's built-in `auth` app. The dependency declaration ensures the `auth` migrations run first — otherwise the `CREATE TABLE` for User would fail trying to reference tables that do not exist yet.

Cross-app dependencies appear whenever a model has a FK to another app's model. In this project, `pets` depends on `accounts` (Pet has an FK to User), and `inquiries` depends on both.

### Operations

```python
operations = [
    migrations.CreateModel(name="User", fields=[...]),
    migrations.CreateModel(name="Friendship", fields=[...], options={...}),
]
```

Each `CreateModel` operation generates one `CREATE TABLE` statement. The `fields` list is complete — it includes `password`, `last_login`, and `is_superuser` which come from `AbstractBaseUser` and `PermissionsMixin`, not from `models.py` directly. The migration is self-contained and does not reference the parent classes at run time.

### Constraints in the migration

Constraints are stored under `options`, not `fields`, and the `Q` / `F` objects are serialised to their tuple form:

```python
models.CheckConstraint(
    condition=models.Q(
        ("requester", models.F("addressee")), _negated=True
    ),
    name="no_self_friendship",
),
```

`_negated=True` is the serialised form of `~Q(...)`. At migrate time Django reconstructs the Q, negates it, and generates the correct `CHECK` SQL.

### `settings.AUTH_USER_MODEL`

FKs to the User model use `to=settings.AUTH_USER_MODEL` in migrations rather than `"accounts.User"`. This is Django's swappable-user mechanism — if the user model is ever changed in settings, FK targets resolve correctly without editing migration files.

---

## References

- Note 510 — ORM basics, QuerySets, N+1 patterns
- Note 530 — data modelling and index design principles
- Django docs: custom User — https://docs.djangoproject.com/en/5.2/topics/auth/customizing/
