import tempfile

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Friendship
from accounts.tests import auth, image_file, make_user
from pets.tests import PET_PAYLOAD

from .models import Notification
from .serializers import NotificationSerializer
from .services import notify


def titles(user):
    return list(user.notifications.values_list('title', flat=True))


class NotifyTests(APITestCase):

    def test_frame_matches_the_stored_row(self):
        alice = make_user('alice', 1)
        layer = get_channel_layer()
        channel = async_to_sync(layer.new_channel)()
        async_to_sync(layer.group_add)(f'user.{alice.pk}', channel)

        notification = notify(alice, 'create', 'Listing published', 'Karo is now listed.', subject=alice)

        frame = async_to_sync(layer.receive)(channel)
        self.assertEqual(frame['type'], 'notification.created')
        self.assertEqual(frame['notification'], NotificationSerializer(Notification.objects.get()).data)
        self.assertEqual(notification.subject_type, 'user')
        self.assertEqual(notification.subject_id, alice.pk)


class EndpointTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        auth(self.client, self.alice)

    def test_list_is_newest_first_paginated_and_only_mine(self):
        for n in range(31):
            notify(self.alice, 'info', f'Note {n}', 'Body')
        notify(self.bob, 'info', 'Not yours', 'Body')

        r = self.client.get(reverse('notification-list'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 31)
        self.assertEqual(len(r.data['results']), 30)
        self.assertEqual(r.data['results'][0]['title'], 'Note 30')

        r = self.client.get(reverse('notification-list'), {'page': 2})
        self.assertEqual([n['title'] for n in r.data['results']], ['Note 0'])

    def test_read_all_flips_only_my_rows(self):
        notify(self.alice, 'info', 'Mine', 'Body')
        notify(self.bob, 'info', 'Not yours', 'Body')

        r = self.client.post(reverse('notification-read-all'))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(self.alice.notifications.filter(is_read=False).exists())
        self.assertTrue(self.bob.notifications.filter(is_read=False).exists())

    def test_clear_all_deletes_only_my_rows(self):
        notify(self.alice, 'info', 'Mine', 'Body')
        notify(self.bob, 'info', 'Not yours', 'Body')

        r = self.client.delete(reverse('notification-list'))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(titles(self.alice), [])
        self.assertEqual(titles(self.bob), ['Not yours'])

    def test_unread_count_in_me_follows_every_operation(self):
        def unread():
            return self.client.get(reverse('auth-me')).data['unread_notifications']

        notify(self.alice, 'info', 'One', 'Body')
        notify(self.alice, 'info', 'Two', 'Body')
        self.assertEqual(unread(), 2)
        self.client.post(reverse('notification-read-all'))
        self.assertEqual(unread(), 0)
        notify(self.alice, 'info', 'Three', 'Body')
        self.assertEqual(unread(), 1)
        self.client.delete(reverse('notification-list'))
        self.assertEqual(unread(), 0)

    def test_requires_auth(self):
        self.client.credentials()
        for r in [
            self.client.get(reverse('notification-list')),
            self.client.post(reverse('notification-read-all')),
            self.client.delete(reverse('notification-list')),
        ]:
            self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class MutationTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        auth(self.client, self.alice)

    def test_publish_notifies_the_owner_once(self):
        self.client.post(reverse('pet-list'), PET_PAYLOAD, format='multipart')
        self.assertEqual(titles(self.alice), ['Listing published'])
        self.assertEqual(titles(self.bob), [])

    def test_profile_and_avatar_changes_notify_once_each(self):
        self.client.patch(reverse('user-me'), {'bio': 'Hi'})
        self.client.put(reverse('user-avatar'), {'avatar': image_file()}, format='multipart')
        self.client.delete(reverse('user-avatar'))
        self.assertEqual(titles(self.alice), ['Profile updated'] * 3)

    def test_friend_request_notifies_only_the_addressee(self):
        self.client.post(reverse('friendship-list'), {'addressee': str(self.bob.pk)})
        self.assertEqual(titles(self.alice), [])
        self.assertEqual(titles(self.bob), ['Friend request'])

    def test_accept_notifies_both_parties_once(self):
        f = Friendship.objects.create(requester=self.bob, addressee=self.alice)
        self.client.post(reverse('friendship-accept', args=[f.pk]))
        self.assertEqual(titles(self.alice), ['Friend added'])
        self.assertEqual(titles(self.bob), ['Friend added'])

    def test_crossed_request_counts_as_accept(self):
        Friendship.objects.create(requester=self.bob, addressee=self.alice)
        self.client.post(reverse('friendship-list'), {'addressee': str(self.bob.pk)})
        self.assertEqual(titles(self.alice), ['Friend added'])
        self.assertEqual(titles(self.bob), ['Friend added'])

    def test_unfriend_notifies_both_parties_once(self):
        f = Friendship.objects.create(requester=self.bob, addressee=self.alice, status=Friendship.STATUS_ACCEPTED)
        self.client.delete(reverse('friendship-detail', args=[f.pk]))
        self.assertEqual(titles(self.alice), ['Friend removed'])
        self.assertEqual(titles(self.bob), ['Friend removed'])
