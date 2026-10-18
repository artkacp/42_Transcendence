from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.utils import timezone

from accounts.models import User

# Open authenticated sockets per user id: a refcount, because one user can have several tabs.
# This is the source of truth; User.is_online only mirrors it for REST. It lives in the one
# Daphne process's RAM and is only changed on the event loop with no await between read and
# write, so it needs no lock.
connections = {}


# True when this is the user's first socket (0 → 1)
def join(user_id):
    connections[user_id] = connections.get(user_id, 0) + 1
    return connections[user_id] == 1


# True when this was the user's last socket (1 → 0)
def leave(user_id):
    connections[user_id] -= 1
    if connections[user_id]:
        return False
    del connections[user_id]
    return True


# Reads the registry when the write runs, not when the transition happened: a reconnect can
# land while a disconnect's write is still queued, and the last write must match the registry.
@database_sync_to_async
def mirror(user_id):
    online = user_id in connections
    fields = {'is_online': True} if online else {'is_online': False, 'last_seen_at': timezone.now()}
    User.objects.filter(pk=user_id).update(**fields)
    return online


async def announce(user_id):
    online = await mirror(user_id)
    await get_channel_layer().group_send('browse', {'type': 'presence.changed', 'user_id': str(user_id), 'online': online})
