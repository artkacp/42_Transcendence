import hashlib

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests import auth, make_user

from ..keys import check_key, generate_key
from ..models import APIKey

LIST_FIELDS = {'id', 'label', 'prefix', 'created_at', 'last_used_at', 'revoked', 'rate_per_minute'}


def make_key(owner, label='Script'):
    _, prefix, key_hash = generate_key()
    return APIKey.objects.create(owner=owner, label=label, prefix=prefix, key_hash=key_hash)


class APIKeyTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        auth(self.client, self.alice)

    def create(self, **body):
        return self.client.post(reverse('api-key-list'), {'label': 'Script', **body})

    def test_create_returns_full_key_once(self):
        r = self.create()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(r.data), {'id', 'label', 'prefix', 'key', 'created_at'})
        full_key = r.data['key']
        self.assertTrue(full_key.startswith(r.data['prefix'] + '.'))

        r = self.client.get(reverse('api-key-list'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)
        self.assertNotIn('key', r.data[0])
        self.assertNotIn('key_hash', r.data[0])
        self.assertNotIn(full_key, r.content.decode())

    def test_row_stores_only_the_hash(self):
        full_key = self.create().data['key']
        secret = full_key.split('.', 1)[1]
        row = APIKey.objects.get()

        self.assertEqual(row.key_hash, hashlib.sha256(full_key.encode()).hexdigest())
        for field in APIKey._meta.concrete_fields:
            value = str(getattr(row, field.attname))
            self.assertNotIn(full_key, value)
            self.assertNotIn(secret, value)
        self.assertTrue(check_key(full_key, row.key_hash))
        self.assertFalse(check_key(full_key + 'x', row.key_hash))

    def test_list_shows_only_my_keys(self):
        make_key(self.alice, 'Mine')
        make_key(self.bob, 'Not yours')

        r = self.client.get(reverse('api-key-list'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual([k['label'] for k in r.data], ['Mine'])
        self.assertEqual(set(r.data[0]), LIST_FIELDS)

    def test_delete_revokes_and_keeps_row(self):
        key = make_key(self.alice)
        url = reverse('api-key-detail', args=[key.pk])

        r = self.client.delete(url)
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(APIKey.objects.filter(pk=key.pk, revoked=True).exists())

        r = self.client.delete(url)
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_other_users_key_is_404(self):
        key = make_key(self.bob)

        r = self.client.delete(reverse('api-key-detail', args=[key.pk]))
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
        key.refresh_from_db()
        self.assertFalse(key.revoked)

    def test_rate_per_minute_in_post_is_ignored(self):
        r = self.create(rate_per_minute=1000)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(APIKey.objects.get().rate_per_minute)

    def test_label_is_required(self):
        r = self.client.post(reverse('api-key-list'), {'label': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r.data['error'], 'validation_failed')
        self.assertIn('label', r.data['fields'])

    def test_keys_cannot_be_updated(self):
        url = reverse('api-key-detail', args=[make_key(self.alice).pk])
        self.assertEqual(self.client.put(url, {'label': 'New'}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.patch(url, {'rate_per_minute': 1000}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_requires_auth(self):
        key = make_key(self.alice)
        self.client.credentials()
        for r in [
            self.client.get(reverse('api-key-list')),
            self.client.post(reverse('api-key-list'), {'label': 'Script'}),
            self.client.delete(reverse('api-key-detail', args=[key.pk])),
        ]:
            self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        key.refresh_from_db()
        self.assertFalse(key.revoked)
        self.assertEqual(APIKey.objects.count(), 1)
