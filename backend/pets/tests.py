from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests import auth, make_user

from .models import AGE_BUCKETS, BREEDS, CITIES, TRAITS


class PetOptionsTests(APITestCase):

    def test_options_match_vocabularies(self):
        auth(self.client, make_user('alice', 1))
        r = self.client.get(reverse('pet-options'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['species'], ['dog', 'cat'])
        self.assertEqual(r.data['sizes'], ['small', 'medium', 'large'])
        self.assertEqual(r.data['sexes'], ['male', 'female'])
        self.assertEqual(r.data['cities'], CITIES)
        self.assertEqual(r.data['breeds'], BREEDS)
        self.assertEqual(r.data['traits'], TRAITS)
        self.assertEqual(r.data['age_buckets'], AGE_BUCKETS)

    def test_options_require_authentication(self):
        r = self.client.get(reverse('pet-options'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
