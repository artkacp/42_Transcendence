import uuid

from django.db import models


class AnalyticsEvent(models.Model):
    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    pet_id = models.UUIDField(null=True)
    event_type = models.CharField(max_length=30)
    occurred_at = models.DateTimeField()
    metadata = models.JSONField()

    class Meta:
        managed = False
        db_table = 'analytics_event'
