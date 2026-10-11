from core.realtime import push

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
    push(f'user.{recipient.pk}', 'notification.created', notification=NotificationSerializer(notification).data)
    return notification
