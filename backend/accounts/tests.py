from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.models import Notification

from .models import Friendship, User


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
