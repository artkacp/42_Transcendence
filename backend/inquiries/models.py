import uuid

from django.db import models

from core.uploads import UploadTo


STAGE_CHOICES = [
    ('conversation', 'Conversation'),
    ('visit', 'Visit'),
    ('decision', 'Decision'),
    ('denied', 'Denied'),
]

ATTACHMENT_KIND_CHOICES = [
    ('image', 'Image'),
    ('document', 'Document'),
]

MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_MESSAGE_LENGTH = 2000


class Inquiry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pet = models.ForeignKey(
        'pets.Pet',
        on_delete=models.CASCADE,
        related_name='inquiries',
    )
    adopter = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='inquiries',
    )
    stage = models.CharField(max_length=15, choices=STAGE_CHOICES, default='conversation')
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['pet', 'adopter'],
                name='unique_inquiry_per_pet_adopter',
            ),
        ]
        indexes = [
            models.Index(
                fields=['adopter', '-last_message_at'],
                name='inquiry_adopter_last_msg_idx',
            ),
            models.Index(
                fields=['pet', '-last_message_at'],
                name='inquiry_pet_last_msg_idx',
            ),
        ]


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inquiry = models.ForeignKey(
        Inquiry,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='messages',
    )
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['inquiry', 'created_at'], name='message_inquiry_created_idx'),
        ]


class Attachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
    )
    uploaded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file = models.FileField(upload_to=UploadTo('attachments'))
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.IntegerField()
    kind = models.CharField(max_length=10, choices=ATTACHMENT_KIND_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(size_bytes__lte=MAX_ATTACHMENT_BYTES),
                name='attachment_max_size',
            ),
        ]
