import uuid

from django.db import models


class APIKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='api_keys',
    )
    label = models.CharField(max_length=100)
    # Plaintext start of the key, used to find the row; unique already creates the index.
    prefix = models.CharField(max_length=8, unique=True)
    # SHA-256 hex digest of the full key (see api/keys.py).
    key_hash = models.CharField(max_length=64)
    # Null means the default limit of 60 requests per minute.
    rate_per_minute = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.label} ({self.prefix})'
