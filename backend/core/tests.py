import io
import tempfile
from datetime import timedelta
from unittest.mock import patch

from asgiref.sync import async_to_sync, sync_to_async
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.core.management import call_command
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from accounts.tests import image_file, make_pet, make_user
from analytics.db.engine import engine
from config.asgi import application
from inquiries.models import Attachment, Inquiry, Message
from inquiries.services import change_stage
from pets.tests import PET_PAYLOAD

from . import presence
from .realtime import push

# The test runner adds testserver to ALLOWED_HOSTS
ORIGIN = b'http://testserver'


def socket(origin=ORIGIN):
    return WebsocketCommunicator(application, '/ws/', headers=[(b'origin', origin)])


def presence_frame(user, online):
    return {'type': 'presence.changed', 'user_id': str(user.pk), 'online': online}


# TransactionTestCase: database_sync_to_async closes the connection, which a TestCase transaction can't survive
class SocketTestCase(TransactionTestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.token = str(AccessToken.for_user(self.alice))

    def tearDown(self):
        async_to_sync(get_channel_layer().flush)()
        # A test that fails before closing its sockets must not leave users online for the next one
        presence.connections.clear()

    # Chat and listing tests write analytics events through SQLAlchemy's own pool; close it so
    # the test database can be dropped at the end (as in analytics/tests.py)
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        super().tearDownClass()

    # analytics_event has a FK to pets_pet, so the flush between tests needs CASCADE (as in analytics/tests.py)
    def _fixture_teardown(self):
        for db_name in self._databases_names(include_mirrors=False):
            call_command('flush', verbosity=0, interactive=False, database=db_name,
                         reset_sequences=False, allow_cascade=True)

    async def signed_in(self, user=None):
        token = str(AccessToken.for_user(user)) if user else self.token
        communicator = socket()
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.send_json_to({'type': 'auth', 'token': token})
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

    async def assert_still_open(self, communicator, user):
        await sync_to_async(push)(f'user.{user.pk}', 'notification.created', notification={'title': 'Still here'})
        self.assertEqual((await communicator.receive_json_from())['type'], 'notification.created')


class SocketTests(SocketTestCase):

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
        await communicator.send_json_to({'type': 'chat.send', 'inquiry_id': 'x', 'body': 'Hi'})
        await self.assert_closed_unauthorized(communicator)

    @override_settings(WS_AUTH_TIMEOUT=1)
    async def test_silent_socket_closes_with_4401_after_timeout(self):
        communicator = socket()
        await communicator.connect()
        await self.assert_closed_unauthorized(communicator, timeout=3)

    async def test_unknown_frames_after_auth_keep_the_socket_open(self):
        communicator = await self.signed_in()

        await communicator.send_json_to({'type': 'nonsense'})
        await communicator.send_json_to({'type': ['not', 'a', 'string']})
        await communicator.send_json_to({'type': 'auth', 'token': self.token})
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


class PresenceTests(SocketTestCase):

    def setUp(self):
        super().setUp()
        self.bob = make_user('bob', 2)

    async def test_first_socket_marks_user_online_and_tells_browse(self):
        watcher = await self.signed_in(self.bob)
        tab = await self.signed_in()

        # auth.ok only goes out once the mirror is written
        await self.alice.arefresh_from_db()
        self.assertTrue(self.alice.is_online)
        self.assertEqual(await watcher.receive_json_from(), presence_frame(self.alice, True))
        self.assertTrue(await tab.receive_nothing())

        await tab.disconnect()
        await watcher.disconnect()

    async def test_second_tab_opening_and_closing_keeps_user_online_silently(self):
        watcher = await self.signed_in(self.bob)
        first = await self.signed_in()
        self.assertEqual(await watcher.receive_json_from(), presence_frame(self.alice, True))

        second = await self.signed_in()
        await first.disconnect()

        self.assertEqual(presence.connections[self.alice.pk], 1)
        await self.alice.arefresh_from_db()
        self.assertTrue(self.alice.is_online)
        self.assertTrue(await watcher.receive_nothing())

        await second.disconnect()
        await watcher.disconnect()

    async def test_closing_the_last_tab_marks_user_offline(self):
        first = await self.signed_in()
        second = await self.signed_in()
        watcher = await self.signed_in(self.bob)
        before = timezone.now()

        await first.disconnect()
        await second.disconnect()

        self.assertEqual(await watcher.receive_json_from(), presence_frame(self.alice, False))
        self.assertTrue(await watcher.receive_nothing())
        self.assertNotIn(self.alice.pk, presence.connections)
        await self.alice.arefresh_from_db()
        self.assertFalse(self.alice.is_online)
        self.assertGreaterEqual(self.alice.last_seen_at, before)

        await watcher.disconnect()

    @override_settings(WS_AUTH_TIMEOUT=1)
    async def test_sockets_closed_with_4401_leave_presence_alone(self):
        tab = await self.signed_in()
        expired = AccessToken.for_user(self.alice)
        expired.set_exp(lifetime=-timedelta(minutes=1))

        await self.assert_auth_error('not-a-jwt')
        await self.assert_auth_error(str(expired))
        wrong_first_frame = socket()
        await wrong_first_frame.connect()
        await wrong_first_frame.send_json_to({'type': 'pet.subscribe'})
        await self.assert_closed_unauthorized(wrong_first_frame)
        silent = socket()
        await silent.connect()
        await self.assert_closed_unauthorized(silent, timeout=3)

        self.assertEqual(presence.connections, {self.alice.pk: 1})
        await self.alice.arefresh_from_db()
        self.assertTrue(self.alice.is_online)
        self.assertIsNone(self.alice.last_seen_at)
        self.assertTrue(await tab.receive_nothing())

        await tab.disconnect()

    def test_reset_presence_marks_everyone_offline(self):
        User.objects.update(is_online=True)
        out = io.StringIO()

        call_command('reset_presence', stdout=out)

        self.assertFalse(User.objects.filter(is_online=True).exists())
        self.assertIn('2 users marked offline', out.getvalue())

    async def test_me_shows_is_online_while_a_socket_is_open(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        me = sync_to_async(client.get)

        tab = await self.signed_in()
        self.assertTrue((await me(reverse('auth-me'))).data['is_online'])

        await tab.disconnect()
        self.assertFalse((await me(reverse('auth-me'))).data['is_online'])


def chat(inquiry, body='', attachment_ids=()):
    return {'type': 'chat.send', 'inquiry_id': str(inquiry.pk), 'body': body, 'attachment_ids': list(attachment_ids)}


def error(kind, detail):
    return {'type': 'error', 'for': kind, 'detail': detail}


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class FrameTests(SocketTestCase):

    def setUp(self):
        super().setUp()
        self.owner = self.alice
        self.adopter = make_user('bob', 2)
        self.carol = make_user('carol', 3)
        self.pet = make_pet(self.owner)
        self.inquiry = Inquiry.objects.create(pet=self.pet, adopter=self.adopter)

    def client_for(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(user)}')
        return client

    # Signs all three in and drops the presence frames those sign-ins caused
    async def everyone(self):
        sockets = [await self.signed_in(user) for user in (self.owner, self.adopter, self.carol)]
        for communicator in sockets:
            while not await communicator.receive_nothing():
                await communicator.receive_output()
        return sockets

    async def pet_frame(self, communicator, kind, pet):
        await communicator.send_json_to({'type': kind, 'pet_id': str(pet.pk)})
        # No reply on success; the wait gives the consumer time to join or leave the group
        self.assertTrue(await communicator.receive_nothing())

    async def analytics_frame(self, communicator, kind):
        await communicator.send_json_to({'type': kind})
        # Same as pet_frame: an error frame would show up here instead of nothing
        self.assertTrue(await communicator.receive_nothing())

    async def assert_both_got_chat(self, owner, adopter, sender, body, attachment_ids=()):
        frames = [await owner.receive_json_from(), await adopter.receive_json_from()]
        message = await Message.objects.aget()
        self.assertEqual(message.sender_id, sender.pk)
        for frame in frames:
            self.assertEqual(frame['type'], 'chat.message')
            self.assertEqual(frame['message']['id'], str(message.pk))
            self.assertEqual(frame['message']['inquiry'], str(self.inquiry.pk))
            self.assertEqual(frame['message']['sender']['id'], str(sender.pk))
            self.assertEqual(frame['message']['body'], body)
            self.assertEqual([a['id'] for a in frame['message']['attachments']], list(attachment_ids))
        return message

    async def test_subscribed_socket_gets_pet_pushes_until_it_unsubscribes(self):
        tab = await self.signed_in(self.carol)
        adopted = {'pet_id': str(self.pet.pk), 'adopted_by_id': str(self.adopter.pk)}

        await self.pet_frame(tab, 'pet.subscribe', self.pet)
        await sync_to_async(push)(f'pet.{self.pet.pk}', 'pet.adopted', **adopted)
        self.assertEqual(await tab.receive_json_from(), {'type': 'pet.adopted', **adopted})

        await self.pet_frame(tab, 'pet.unsubscribe', self.pet)
        await sync_to_async(push)(f'pet.{self.pet.pk}', 'pet.adopted', **adopted)
        self.assertTrue(await tab.receive_nothing())

        await tab.disconnect()

    async def test_signed_in_socket_gets_no_analytics_pings_without_subscribing(self):
        tab = await self.signed_in(self.carol)

        await sync_to_async(push)('analytics', 'analytics.ping')
        self.assertTrue(await tab.receive_nothing())

        await tab.disconnect()

    async def test_subscribed_socket_gets_analytics_pings_until_it_unsubscribes(self):
        tab = await self.signed_in(self.carol)

        await self.analytics_frame(tab, 'analytics.subscribe')
        await sync_to_async(push)('analytics', 'analytics.ping')
        self.assertEqual(await tab.receive_json_from(), {'type': 'analytics.ping'})

        await self.analytics_frame(tab, 'analytics.unsubscribe')
        await sync_to_async(push)('analytics', 'analytics.ping')
        self.assertTrue(await tab.receive_nothing())

        await tab.disconnect()

    async def test_subscribing_to_analytics_twice_gets_one_ping_per_push(self):
        tab = await self.signed_in(self.carol)

        await self.analytics_frame(tab, 'analytics.subscribe')
        await self.analytics_frame(tab, 'analytics.subscribe')
        await sync_to_async(push)('analytics', 'analytics.ping')
        self.assertEqual(await tab.receive_json_from(), {'type': 'analytics.ping'})
        self.assertTrue(await tab.receive_nothing())

        await tab.disconnect()
        self.assertFalse(get_channel_layer().groups.get('analytics'))

    async def test_pet_subscriber_gets_no_chat_or_stage_frames(self):
        owner, adopter, carol = await self.everyone()
        await self.pet_frame(carol, 'pet.subscribe', self.pet)

        await adopter.send_json_to(chat(self.inquiry, 'Private'))
        self.assertEqual((await owner.receive_json_from())['type'], 'chat.message')
        await database_sync_to_async(change_stage)(self.owner, self.inquiry.pk, 'visit')
        types = [(await owner.receive_json_from())['type'] for _ in range(3)]
        self.assertEqual(types, ['notification.created', 'notification.created', 'inquiry.stage_changed'])

        self.assertTrue(await carol.receive_nothing())
        for communicator in (owner, adopter, carol):
            await communicator.disconnect()

    async def test_adopter_chat_reaches_both_parties_and_binds_attachments(self):
        upload = await sync_to_async(self.client_for(self.adopter).post)(
            reverse('attachment-list'), {'file': image_file()}, format='multipart')
        attachment_id = upload.data['id']
        owner, adopter, carol = await self.everyone()

        await adopter.send_json_to(chat(self.inquiry, 'Hi!', [attachment_id]))

        message = await self.assert_both_got_chat(owner, adopter, self.adopter, 'Hi!', [attachment_id])
        self.assertTrue(await Attachment.objects.filter(pk=attachment_id, message=message).aexists())
        # Success sends the sender nothing beyond chat.message
        self.assertTrue(await adopter.receive_nothing())
        for communicator in (owner, adopter, carol):
            await communicator.disconnect()

    async def test_owner_chat_reaches_both_parties(self):
        owner, adopter, carol = await self.everyone()

        await owner.send_json_to(chat(self.inquiry, 'Come visit'))

        await self.assert_both_got_chat(owner, adopter, self.owner, 'Come visit')
        self.assertTrue(await owner.receive_nothing())
        for communicator in (owner, adopter, carol):
            await communicator.disconnect()

    async def test_non_participant_chat_is_refused(self):
        tab = await self.signed_in(self.carol)

        await tab.send_json_to(chat(self.inquiry, 'Let me in'))

        self.assertEqual(await tab.receive_json_from(), error('chat.send', 'Not found.'))
        self.assertFalse(await Message.objects.aexists())
        await self.assert_still_open(tab, self.carol)
        await tab.disconnect()

    async def test_chat_without_body_or_attachments_is_refused(self):
        tab = await self.signed_in(self.adopter)

        await tab.send_json_to(chat(self.inquiry, '   '))

        self.assertEqual(await tab.receive_json_from(), error('chat.send', 'A message needs text or at least one attachment.'))
        self.assertFalse(await Message.objects.aexists())
        await self.assert_still_open(tab, self.adopter)
        await tab.disconnect()

    async def test_unexpected_failure_is_logged_and_presence_still_ends(self):
        tab = await self.signed_in(self.adopter)

        with (
            patch('core.consumers.send_message', side_effect=RuntimeError('boom')),
            self.assertLogs('core.consumers', 'ERROR') as logs,
        ):
            await tab.send_json_to(chat(self.inquiry, 'Hi'))
            self.assertEqual(await tab.receive_json_from(), error('chat.send', 'Something went wrong.'))

        self.assertIsNotNone(logs.records[0].exc_info)
        self.assertEqual(presence.connections[self.adopter.pk], 1)
        await self.assert_still_open(tab, self.adopter)

        await tab.disconnect()
        self.assertNotIn(self.adopter.pk, presence.connections)
        await self.adopter.arefresh_from_db()
        self.assertFalse(self.adopter.is_online)

    async def test_invalid_pet_frames_get_an_error_frame(self):
        tab = await self.signed_in(self.carol)

        await tab.send_json_to({'type': 'pet.subscribe', 'pet_id': 'not-a-uuid'})
        self.assertEqual(await tab.receive_json_from(), error('pet.subscribe', 'Must be a valid UUID.'))
        await tab.send_json_to({'type': 'pet.unsubscribe'})
        self.assertEqual(await tab.receive_json_from(), error('pet.unsubscribe', 'This field is required.'))

        await self.assert_still_open(tab, self.carol)
        await tab.disconnect()

    async def test_new_listing_is_pushed_to_browse(self):
        tab = await self.signed_in(self.carol)
        client = self.client_for(self.owner)

        created = await sync_to_async(client.post)(reverse('pet-list'), PET_PAYLOAD, format='multipart')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        # The same serializer GET /api/pets/{id}/ uses
        shown = await sync_to_async(client.get)(reverse('pet-detail', args=[created.data['id']]))
        self.assertEqual(await tab.receive_json_from(), {'type': 'pet.published', 'pet': shown.json()})
        await tab.disconnect()

    async def test_disconnect_leaves_every_pet_group(self):
        other = await database_sync_to_async(make_pet)(self.owner, name='Kobi')
        tab = await self.signed_in(self.carol)
        groups = [f'pet.{pet.pk}' for pet in (self.pet, other)]

        for pet in (self.pet, other):
            await self.pet_frame(tab, 'pet.subscribe', pet)
        layer = get_channel_layer()
        for group in groups:
            self.assertTrue(layer.groups.get(group))

        await tab.disconnect()
        for group in groups:
            self.assertFalse(layer.groups.get(group))
