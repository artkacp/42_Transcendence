import uuid

from django.db import models


KIND_CHOICES = [
    ('create', 'Create'),
    ('update', 'Update'),
    ('delete', 'Delete'),
    ('info', 'Info'),
]


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    title = models.CharField(max_length=200)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    subject_type = models.CharField(max_length=50, null=True, blank=True)
    subject_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['recipient', '-created_at'],
                name='notif_recipient_created_idx',
            ),
            models.Index(
                fields=['recipient'],
                condition=models.Q(is_read=False),
                name='notification_unread_idx',
            ),
        ]
