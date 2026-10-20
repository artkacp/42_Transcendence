from datetime import timedelta

from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.core.management import call_command
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from accounts.tests import make_user
from config.asgi import application

from .realtime import push

# The test runner adds testserver to ALLOWED_HOSTS
ORIGIN = b'http://testserver'


def socket(origin=ORIGIN):
    return WebsocketCommunicator(application, '/ws/', headers=[(b'origin', origin)])


# TransactionTestCase: database_sync_to_async closes the connection, which a TestCase transaction can't survive
class SocketTests(TransactionTestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.token = str(AccessToken.for_user(self.alice))

    def tearDown(self):
        async_to_sync(get_channel_layer().flush)()

    # analytics_event has a FK to pets_pet, so the flush between tests needs CASCADE (as in analytics/tests.py)
    def _fixture_teardown(self):
        for db_name in self._databases_names(include_mirrors=False):
            call_command('flush', verbosity=0, interactive=False, database=db_name,
                         reset_sequences=False, allow_cascade=True)

    async def signed_in(self):
        communicator = socket()
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.send_json_to({'type': 'auth', 'token': self.token})
        self.assertEqual(await communicator.receive_json_from(), {'type': 'auth.ok'})
        return communicator

    async def assert_closed_unauthorized(self, communicator, timeout=1):
        self.assertEqual(await communicator.receive_output(timeout), {'type': 'websocket.close', 'code': 4401})
        await communicator.disconnect()

    async def assert_auth_error(self, token):
        communicator = socket()
        await communicator.connect()
        await communicator.send_json_to({'type': 'auth', 'token': token})
        self.assertEqual(await communicator.receive_json_from(), {'type': 'auth.error'})
        await self.assert_closed_unauthorized(communicator)

    async def test_valid_token_joins_user_and_browse_groups(self):
        communicator = await self.signed_in()

        await sync_to_async(push)(f'user.{self.alice.pk}', 'notification.created', notification={'title': 'Hi'})
        self.assertEqual(await communicator.receive_json_from(), {'type': 'notification.created', 'notification': {'title': 'Hi'}})
        await sync_to_async(push)('browse', 'pet.removed', pet_id='42')
        self.assertEqual(await communicator.receive_json_from(), {'type': 'pet.removed', 'pet_id': '42'})

        await communicator.disconnect()
        layer = get_channel_layer()
        self.assertFalse(layer.groups.get(f'user.{self.alice.pk}'))
        self.assertFalse(layer.groups.get('browse'))

    async def test_invalid_token_gets_auth_error_then_4401(self):
        await self.assert_auth_error('not-a-jwt')

    async def test_expired_token_gets_auth_error_then_4401(self):
        token = AccessToken.for_user(self.alice)
        token.set_exp(lifetime=-timedelta(minutes=1))
        await self.assert_auth_error(str(token))

    async def test_inactive_user_gets_auth_error_then_4401(self):
        await User.objects.filter(pk=self.alice.pk).aupdate(is_active=False)
        await self.assert_auth_error(self.token)

    async def test_non_auth_first_frame_closes_with_4401(self):
        communicator = socket()
        await communicator.connect()
        await communicator.send_json_to({'type': 'chat.send', 'inquiryId': 'x', 'body': 'Hi'})
        await self.assert_closed_unauthorized(communicator)

    @override_settings(WS_AUTH_TIMEOUT=1)
    async def test_silent_socket_closes_with_4401_after_timeout(self):
        communicator = socket()
        await communicator.connect()
        await self.assert_closed_unauthorized(communicator, timeout=3)

    async def test_unknown_frames_after_auth_keep_the_socket_open(self):
        communicator = await self.signed_in()

        await communicator.send_json_to({'type': 'pet.subscribe', 'petId': 'x'})
        await communicator.send_json_to({'type': 'nonsense'})
        await communicator.send_to(text_data='not json')
        self.assertTrue(await communicator.receive_nothing())

        await sync_to_async(push)('browse', 'pet.removed', pet_id='42')
        self.assertEqual(await communicator.receive_json_from(), {'type': 'pet.removed', 'pet_id': '42'})
        await communicator.disconnect()

    async def test_foreign_origin_is_rejected(self):
        communicator = socket(b'https://evil.example')
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()
