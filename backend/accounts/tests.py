import io
import tempfile
from unittest import mock

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.models import Notification
from pets.models import Pet

from .models import Friendship, User
from .views import FriendshipViewSet


def make_user(handle, n):
    return User.objects.create_user(
        email=f'{handle}@test.com',
        full_name=f'User {n}',
        handle=handle,
        password='pass',
    )


def auth(client, user):
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


def image_file(name='avatar.png', size=(10, 10), format='PNG'):
    buffer = io.BytesIO()
    Image.new('RGB', size).save(buffer, format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f'image/{format.lower()}')


def make_pet(owner, **overrides):
    return Pet.objects.create(**{
        'owner': owner,
        'name': 'Karo',
        'species': 'dog',
        'breed': 'Poodle',
        'age_years': 2,
        'size': 'small',
        'sex': 'male',
        'city': 'Kraków',
        'story': 'A friendly and energetic puppy.',
        'traits': ['friendly'],
        **overrides,
    })


def pair_lookup_misses_once():
    # Concurrent requests can't be run in a TestCase, so fake the losing side of
    # the race: its pre-insert lookup finds nothing, then the insert hits the
    # row the other request already created
    original = FriendshipViewSet._find_pair
    calls = []

    def find_pair(view, me, other_id):
        calls.append(other_id)
        return None if len(calls) == 1 else original(view, me, other_id)

    return mock.patch.object(FriendshipViewSet, '_find_pair', find_pair)


class FriendshipTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        self.carol = make_user('carol', 3)

    # --- send request ---

    def test_send_request_creates_pending_row(self):
        auth(self.client, self.alice)
        r = self.client.post(reverse('friendship-list'), {'addressee': str(self.bob.pk)})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['status'], 'pending')

    def test_send_request_to_self_rejected(self):
        auth(self.client, self.alice)
        r = self.client.post(reverse('friendship-list'), {'addressee': str(self.alice.pk)})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_request_rejected(self):
        Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.alice)
        r = self.client.post(reverse('friendship-list'), {'addressee': str(self.bob.pk)})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_request_to_nonexistent_user_rejected(self):
        import uuid
        auth(self.client, self.alice)
        r = self.client.post(reverse('friendship-list'), {'addressee': str(uuid.uuid4())})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reverse_request_auto_accepts(self):
        Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.bob)
        r = self.client.post(reverse('friendship-list'), {'addressee': str(self.alice.pk)})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['status'], 'accepted')

    def test_reverse_row_violates_unordered_pair_constraint(self):
        Friendship.objects.create(requester=self.alice, addressee=self.bob)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Friendship.objects.create(requester=self.bob, addressee=self.alice)

    def test_racing_duplicate_request_rejected_not_500(self):
        Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.alice)
        with pair_lookup_misses_once():
            r = self.client.post(reverse('friendship-list'), {'addressee': str(self.bob.pk)})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Friendship.objects.count(), 1)

    def test_racing_reverse_request_accepts_pending(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.bob)
        with pair_lookup_misses_once():
            r = self.client.post(reverse('friendship-list'), {'addressee': str(self.alice.pk)})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['status'], 'accepted')
        self.assertEqual(Friendship.objects.get().pk, f.pk)
        self.assertEqual(Friendship.objects.get().status, Friendship.STATUS_ACCEPTED)
        self.assertEqual(Notification.objects.filter(title='Friend added').count(), 2)
        self.assertFalse(Notification.objects.filter(title='Friend request').exists())

    # --- accept ---

    def test_addressee_can_accept(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.bob)
        r = self.client.post(reverse('friendship-accept', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['status'], 'accepted')

    def test_requester_cannot_accept_own_request(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.alice)
        r = self.client.post(reverse('friendship-accept', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_third_party_cannot_accept(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.carol)
        r = self.client.post(reverse('friendship-accept', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_accept_already_accepted_rejected(self):
        f = Friendship.objects.create(
            requester=self.alice, addressee=self.bob, status=Friendship.STATUS_ACCEPTED
        )
        auth(self.client, self.bob)
        r = self.client.post(reverse('friendship-accept', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_second_accept_rejected_without_notifying_again(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.bob)
        first = self.client.post(reverse('friendship-accept', args=[f.pk]))
        # A request that loaded the row while it was still pending
        stale = Friendship.objects.select_related('requester', 'addressee').get(pk=f.pk)
        stale.status = Friendship.STATUS_PENDING
        with mock.patch.object(FriendshipViewSet, '_get_friendship', return_value=stale):
            second = self.client.post(reverse('friendship-accept', args=[f.pk]))
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Notification.objects.filter(title='Friend added').count(), 2)

    # --- destroy (reject / cancel / unfriend) ---

    def test_addressee_can_reject_pending(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.bob)
        r = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Friendship.objects.filter(pk=f.pk).exists())

    def test_requester_can_cancel_pending(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.alice)
        r = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_either_party_can_unfriend(self):
        f = Friendship.objects.create(
            requester=self.alice, addressee=self.bob, status=Friendship.STATUS_ACCEPTED
        )
        auth(self.client, self.bob)
        r = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_third_party_cannot_delete(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        auth(self.client, self.carol)
        r = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_second_unfriend_not_found_without_notifying_again(self):
        f = Friendship.objects.create(
            requester=self.alice, addressee=self.bob, status=Friendship.STATUS_ACCEPTED
        )
        # A request that loaded the row before the first delete removed it
        stale = Friendship.objects.select_related('requester', 'addressee').get(pk=f.pk)
        auth(self.client, self.bob)
        first = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        with mock.patch.object(FriendshipViewSet, '_get_friendship', return_value=stale):
            second = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(first.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(second.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Notification.objects.filter(title='Friend removed').count(), 2)

    def test_cancel_racing_accept_notifies_removal(self):
        f = Friendship.objects.create(requester=self.alice, addressee=self.bob)
        # Loaded while pending, then accepted before the delete ran
        stale = Friendship.objects.select_related('requester', 'addressee').get(pk=f.pk)
        Friendship.objects.filter(pk=f.pk).update(status=Friendship.STATUS_ACCEPTED)
        auth(self.client, self.alice)
        with mock.patch.object(FriendshipViewSet, '_get_friendship', return_value=stale):
            r = self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Friendship.objects.exists())
        self.assertEqual(Notification.objects.filter(title='Friend removed').count(), 2)

    # --- list / incoming / outgoing ---

    def test_list_returns_accepted_only(self):
        Friendship.objects.create(
            requester=self.alice, addressee=self.bob, status=Friendship.STATUS_ACCEPTED
        )
        Friendship.objects.create(requester=self.alice, addressee=self.carol)
        auth(self.client, self.alice)
        r = self.client.get(reverse('friendship-list'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]['other_user']['handle'], 'bob')

    def test_incoming_returns_pending_received(self):
        Friendship.objects.create(requester=self.alice, addressee=self.bob)
        Friendship.objects.create(requester=self.carol, addressee=self.bob)
        auth(self.client, self.bob)
        r = self.client.get(reverse('friendship-incoming'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_outgoing_returns_pending_sent(self):
        Friendship.objects.create(requester=self.alice, addressee=self.bob)
        Friendship.objects.create(requester=self.alice, addressee=self.carol)
        auth(self.client, self.alice)
        r = self.client.get(reverse('friendship-outgoing'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_unauthenticated_request_rejected(self):
        r = self.client.get(reverse('friendship-list'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class AuthTests(APITestCase):
    credentials = {'email': 'dana@test.com', 'password': 'pawfect-pass-42', 'full_name': 'Dana Scully'}

    def register(self, **overrides):
        return self.client.post(reverse('auth-register'), {**self.credentials, **overrides})

    def assert_session(self, r, expected_status):
        self.assertEqual(r.status_code, expected_status)
        self.assertEqual(list(r.data), ['access'])
        cookie = r.cookies[settings.REFRESH_COOKIE_NAME]
        self.assertTrue(cookie['secure'])
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['path'], settings.REFRESH_COOKIE_PATH)
        self.assertEqual(cookie['samesite'], settings.REFRESH_COOKIE_SAMESITE)

    # --- register ---

    def test_register_sets_cookie_and_returns_access_only(self):
        self.assert_session(self.register(), status.HTTP_201_CREATED)

    def test_register_generates_unique_handle(self):
        self.register(handle='hacked')
        self.register(email='other@test.com')
        handles = User.objects.order_by('date_joined').values_list('handle', flat=True)
        self.assertEqual(list(handles), ['dana.scully', 'dana.scully2'])

    def test_register_duplicate_email_returns_field_error(self):
        self.register()
        r = self.register(email='DANA@test.com')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r.data['error'], 'validation_failed')
        self.assertIn('email', r.data['fields'])

    def test_register_weak_password_returns_field_error(self):
        r = self.register(password='12345')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', r.data['fields'])

    # --- login ---

    def test_login_sets_cookie_and_returns_access_only(self):
        self.register()
        self.client.cookies.clear()
        r = self.client.post(reverse('auth-login'), {'email': 'Dana@test.com', 'password': 'pawfect-pass-42'})
        self.assert_session(r, status.HTTP_200_OK)

    def test_login_wrong_password_rejected(self):
        self.register()
        r = self.client.post(reverse('auth-login'), {'email': 'dana@test.com', 'password': 'wrong'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, r.cookies)

    # --- refresh ---

    def test_refresh_rotates_cookie_and_blacklists_old_one(self):
        old = self.register().cookies[settings.REFRESH_COOKIE_NAME].value
        r = self.client.post(reverse('auth-refresh'))
        self.assert_session(r, status.HTTP_200_OK)
        self.assertNotEqual(r.cookies[settings.REFRESH_COOKIE_NAME].value, old)

        self.client.cookies[settings.REFRESH_COOKIE_NAME] = old
        r = self.client.post(reverse('auth-refresh'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_without_cookie_rejected(self):
        r = self.client.post(reverse('auth-refresh'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- logout ---

    def test_logout_invalidates_refresh_token(self):
        r = self.register()
        refresh = r.cookies[settings.REFRESH_COOKIE_NAME].value
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {r.data["access"]}')
        r = self.client.post(reverse('auth-logout'))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(r.cookies[settings.REFRESH_COOKIE_NAME].value, '')

        self.client.cookies[settings.REFRESH_COOKIE_NAME] = refresh
        r = self.client.post(reverse('auth-refresh'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_authentication(self):
        r = self.client.post(reverse('auth-logout'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- me ---

    def test_me_returns_profile_and_unread_count(self):
        user = make_user('dana', 1)
        Notification.objects.create(recipient=user, kind='info', title='Welcome', body='Hi')
        Notification.objects.create(recipient=user, kind='info', title='Old', body='Hi', is_read=True)
        auth(self.client, user)
        r = self.client.get(reverse('auth-me'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['handle'], 'dana')
        self.assertEqual(r.data['email'], 'dana@test.com')
        self.assertEqual(r.data['unread_notifications'], 1)

    def test_me_requires_authentication(self):
        r = self.client.get(reverse('auth-me'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(r.data['error'], 'not_authenticated')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ProfileTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        auth(self.client, self.alice)

    # --- public profile ---

    def test_other_profile_exposes_only_allowed_fields(self):
        r = self.client.get(reverse('user-detail', args=[self.bob.pk]))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(r.data),
            {'id', 'handle', 'full_name', 'avatar', 'is_online', 'city', 'bio', 'friendship'},
        )

    def test_profile_reports_friendship_state(self):
        r = self.client.get(reverse('user-detail', args=[self.bob.pk]))
        self.assertIsNone(r.data['friendship'])

        f = Friendship.objects.create(requester=self.bob, addressee=self.alice)
        r = self.client.get(reverse('user-detail', args=[self.bob.pk]))
        self.assertEqual(r.data['friendship'], {'id': f.pk, 'status': 'pending', 'requested_by_me': False})

    def test_user_pets_returns_active_listings_only(self):
        make_pet(self.bob, name='Active')
        make_pet(self.bob, name='Adopted', adopted_by=self.alice)
        r = self.client.get(reverse('user-pets', args=[self.bob.pk]))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual([p['name'] for p in r.data], ['Active'])

    # --- PATCH /users/me/ ---

    def test_patch_me_updates_profile(self):
        r = self.client.patch(reverse('user-me'), {'full_name': 'Alice W', 'city': 'Gdańsk', 'bio': 'Hi'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.alice.refresh_from_db()
        self.assertEqual((self.alice.full_name, self.alice.city, self.alice.bio), ('Alice W', 'Gdańsk', 'Hi'))

    def test_patch_me_rejects_short_name(self):
        r = self.client.patch(reverse('user-me'), {'full_name': 'A'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('full_name', r.data['fields'])

    def test_patch_me_rejects_city_outside_fixed_list(self):
        r = self.client.patch(reverse('user-me'), {'city': 'Paris'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('city', r.data['fields'])

    def test_patch_me_ignores_handle(self):
        r = self.client.patch(reverse('user-me'), {'handle': 'hacked'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['handle'], 'alice')

    # --- avatar ---

    def upload(self, file):
        return self.client.put(reverse('user-avatar'), {'avatar': file}, format='multipart')

    def test_upload_avatar_replaces_old_file(self):
        self.upload(image_file('first.png'))
        self.alice.refresh_from_db()
        old_name = self.alice.avatar.name
        self.assertRegex(old_name, r'^avatars/[0-9a-f]{32}\.png$')
        self.assertTrue(default_storage.exists(old_name))

        r = self.upload(image_file('second.png'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['avatar'].startswith('http'))
        self.assertFalse(default_storage.exists(old_name))

    def test_upload_rejects_non_image(self):
        r = self.upload(SimpleUploadedFile('notes.txt', b'hello', content_type='text/plain'))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('avatar', r.data['fields'])

    def test_upload_rejects_file_over_2mb(self):
        r = self.upload(image_file('big.bmp', size=(1024, 1024), format='BMP'))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('avatar', r.data['fields'])

    def test_delete_avatar_removes_file(self):
        self.upload(image_file())
        self.alice.refresh_from_db()
        name = self.alice.avatar.name
        r = self.client.delete(reverse('user-avatar'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data['avatar'])
        self.assertFalse(default_storage.exists(name))

    def test_profile_endpoints_require_authentication(self):
        self.client.credentials()
        r = self.client.patch(reverse('user-me'), {'bio': 'x'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
