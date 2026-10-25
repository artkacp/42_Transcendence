from django.core.cache import caches
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests import auth, make_user
from pets.models import AGE_BUCKETS, BREEDS, CITIES, TRAITS

from ..keys import generate_key
from ..models import APIKey

OPTION_FIELDS = {'species', 'breeds', 'sizes', 'sexes', 'cities', 'traits', 'age_buckets'}


def make_key(owner, **fields):
    full_key, prefix, key_hash = generate_key()
    api_key = APIKey.objects.create(owner=owner, label='Script', prefix=prefix, key_hash=key_hash, **fields)
    return api_key, full_key


class PublicAuthTests(APITestCase):

    def setUp(self):
        caches['throttle'].clear()
        self.alice = make_user('alice', 1)
        self.key, self.full_key = make_key(self.alice)

    def get(self, full_key=None):
        headers = {} if full_key is None else {'HTTP_X_API_KEY': full_key}
        return self.client.get(reverse('public-options'), **headers)

    def assertUnauthorized(self, r, detail):
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(r.data['detail'], detail)

    def assertThrottled(self, r):
        self.assertEqual(r.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn(int(r.headers['Retry-After']), range(1, 61))

    def test_no_header_is_401_with_www_authenticate(self):
        r = self.get()
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(r.headers['WWW-Authenticate'], 'X-API-Key')
        self.assertEqual(r.data['error'], 'not_authenticated')

    def test_malformed_key_is_401(self):
        for value in ['nodot', '.secret', f'{self.key.prefix}.']:
            with self.subTest(value=value):
                self.assertUnauthorized(self.get(value), 'Malformed API key.')

    def test_unknown_prefix_is_401(self):
        unsaved_key, _, _ = generate_key()
        self.assertUnauthorized(self.get(unsaved_key), 'Invalid API key.')

    def test_wrong_secret_is_401(self):
        self.assertUnauthorized(self.get(f'{self.key.prefix}.wrong-secret'), 'Invalid API key.')

    def test_revoked_key_is_401_and_never_counted(self):
        self.key.revoked = True
        self.key.save(update_fields=['revoked'])

        self.assertUnauthorized(self.get(self.full_key), 'API key revoked.')
        self.assertIsNone(caches['throttle'].get(str(self.key.id)))

    def test_inactive_owner_is_401(self):
        self.alice.is_active = False
        self.alice.save(update_fields=['is_active'])

        self.assertUnauthorized(self.get(self.full_key), 'User is inactive.')

    def test_valid_key_returns_options_and_sets_last_used_at(self):
        self.assertIsNone(self.key.last_used_at)

        r = self.get(self.full_key)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(set(r.data), OPTION_FIELDS)
        self.assertEqual(r.data['species'], ['dog', 'cat'])
        self.assertEqual(r.data['sizes'], ['small', 'medium', 'large'])
        self.assertEqual(r.data['sexes'], ['male', 'female'])
        self.assertEqual(r.data['breeds'], BREEDS)
        self.assertEqual(r.data['cities'], CITIES)
        self.assertEqual(r.data['traits'], TRAITS)
        self.assertEqual(r.data['age_buckets'], AGE_BUCKETS)

        self.key.refresh_from_db()
        self.assertIsNotNone(self.key.last_used_at)

    def test_jwt_without_key_is_401(self):
        auth(self.client, self.alice)
        r = self.get()
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(r.data['error'], 'not_authenticated')

    def test_default_limit_is_60_per_minute(self):
        for _ in range(60):
            self.assertEqual(self.get(self.full_key).status_code, status.HTTP_200_OK)
        self.assertThrottled(self.get(self.full_key))

    def test_key_rate_per_minute_overrides_default(self):
        _, full_key = make_key(self.alice, rate_per_minute=5)
        for _ in range(5):
            self.assertEqual(self.get(full_key).status_code, status.HTTP_200_OK)
        self.assertThrottled(self.get(full_key))

    def test_keys_have_separate_counters(self):
        _, first = make_key(self.alice, rate_per_minute=1)
        _, second = make_key(self.alice, rate_per_minute=1)

        self.assertEqual(self.get(first).status_code, status.HTTP_200_OK)
        self.assertThrottled(self.get(first))
        self.assertEqual(self.get(second).status_code, status.HTTP_200_OK)

    def test_lowered_limit_still_sends_retry_after(self):
        for _ in range(3):
            self.assertEqual(self.get(self.full_key).status_code, status.HTTP_200_OK)
        APIKey.objects.filter(pk=self.key.pk).update(rate_per_minute=2)

        self.assertThrottled(self.get(self.full_key))
