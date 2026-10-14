from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def push(group, event_type, **payload):
    async_to_sync(get_channel_layer().group_send)(group, {'type': event_type, **payload})
