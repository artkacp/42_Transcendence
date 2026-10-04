from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

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
