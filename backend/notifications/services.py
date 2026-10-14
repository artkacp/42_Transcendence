from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification
from .serializers import NotificationSerializer


def notify(recipient, kind, title, body, subject=None):
    notification = Notification.objects.create(
        recipient=recipient,
        kind=kind,
        title=title,
        body=body,
        subject_type=subject._meta.model_name if subject else None,
        subject_id=subject.pk if subject else None,
    )
    async_to_sync(get_channel_layer().group_send)(
        f'user.{recipient.pk}',
        {'type': 'notification.created', 'notification': NotificationSerializer(notification).data},
    )
    return notification
