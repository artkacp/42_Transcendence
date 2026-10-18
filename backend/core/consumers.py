import asyncio
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from . import presence

UNAUTHORIZED = 4401


@database_sync_to_async
def user_for(token):
    # AccessToken(None) mints a brand-new token instead of failing
    if not isinstance(token, str) or not token:
        return None
    try:
        # Same user lookup and is_active rule as REST requests
        return JWTAuthentication().get_user(AccessToken(token))
    except (TokenError, AuthenticationFailed):
        return None


# The one socket per signed-in session (TRD §6.7). The first frame must be
# {"type": "auth", "token": ...}; the token is checked once, not again when it expires.
class SocketConsumer(AsyncJsonWebsocketConsumer):
    user = None
    deadline = None

    async def connect(self):
        await self.accept()
        self.deadline = asyncio.create_task(self.close_if_silent())

    async def close_if_silent(self):
        await asyncio.sleep(settings.WS_AUTH_TIMEOUT)
        await self.close(code=UNAUTHORIZED)

    async def disconnect(self, code):
        if self.deadline:
            self.deadline.cancel()
        # self.user is only set once auth succeeded, so a socket closed with 4401 was never counted
        if self.user is not None and presence.leave(self.user.pk):
            await presence.announce(self.user.pk)

    # Binary or malformed frames count as "anything else" instead of crashing the consumer
    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        try:
            content = json.loads(text_data) if text_data else None
        except ValueError:
            content = None
        await self.receive_json(content if isinstance(content, dict) else {})

    async def receive_json(self, content, **kwargs):
        if self.user is None:
            await self.authenticate(content)
            return
        # TODO(B8): chat.send → inquiries.services.send_message, which pushes chat.message to pet.<petId>
        # TODO(B8): pet.subscribe → join pet.<petId>
        # TODO(B8): pet.unsubscribe → leave pet.<petId>
        # Anything else after auth (a second auth included) is ignored: no reply, no close.

    async def authenticate(self, content):
        # Only the first frame counts; anything later arrives while the socket is closing
        if self.deadline is None or self.deadline.done():
            return
        self.deadline.cancel()
        self.deadline = None
        if content.get('type') != 'auth':
            await self.close(code=UNAUTHORIZED)
            return
        self.user = await user_for(content.get('token'))
        if self.user is None:
            await self.send_json({'type': 'auth.error'})
            await self.close(code=UNAUTHORIZED)
            return
        # Counted before joining browse, so the user's own socket never hears about itself;
        # auth.ok then only goes out once is_online is already written
        if presence.join(self.user.pk):
            await presence.announce(self.user.pk)
        # Channels leaves self.groups on disconnect
        self.groups = [f'user.{self.user.pk}', 'browse']
        for group in self.groups:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.send_json({'type': 'auth.ok'})

    # push() uses each frame's own type (inquiry.created, pet.adopted, …) as the channel-layer
    # type, so anything that isn't a websocket.* event goes to the client unchanged.
    async def dispatch(self, message):
        if message['type'].startswith('websocket.'):
            await super().dispatch(message)
        else:
            await self.send_json(message)

    # Serializer data can hold UUID objects (e.g. MessageSerializer.inquiry)
    @classmethod
    async def encode_json(cls, content):
        return json.dumps(content, cls=DjangoJSONEncoder)
