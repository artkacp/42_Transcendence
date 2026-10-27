import uuid

from django.core.cache import caches
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.tests import auth, make_pet, make_user
from pets.models import Pet
from pets.serializers import PetFilterSerializer

from .test_public_auth import make_key

PUBLIC_FIELDS = {
    'id', 'name', 'species', 'breed', 'age_years', 'size', 'sex', 'city', 'story', 'traits',
    'is_vaccinated', 'is_neutered', 'photo', 'created_at', 'is_adopted',
}
FILTERS = {'species', 'sex', 'size', 'age_bucket', 'city', 'breed', 'trait', 'vaccinated', 'neutered'}
PUBLIC_PATHS = {'/api/public/v1/options/', '/api/public/v1/pets/', '/api/public/v1/pets/{id}/'}


class PublicPetsTests(APITestCase):

    def setUp(self):
        caches['throttle'].clear()
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        _, self.full_key = make_key(self.alice)
        # The app's Browse (JWT), to compare the public results against.
        self.app = APIClient()
        auth(self.app, self.alice)
        # Same pets as pets.tests.BrowseTests.
        self.karo = make_pet(self.alice, name='Karo', species='dog', breed='Poodle', age_years=0, size='small',
                             sex='male', city='Kraków', traits=['friendly'], is_vaccinated=True)
        self.kobi = make_pet(self.bob, name='Kobi', species='cat', breed='Maine Coon', age_years=3, size='medium',
                             sex='female', city='Gdańsk', traits=['wild', 'cuddly'], is_neutered=True)
        self.max = make_pet(self.bob, name='Max', species='dog', breed='German Shepherd', age_years=9, size='large',
                            sex='male', city='Gdańsk', traits=['loyal'])

    def get(self, url, params=None, key=True):
        headers = {'HTTP_X_API_KEY': self.full_key} if key else {}
        return self.client.get(url, params, **headers)

    def pets(self, **params):
        return self.get(reverse('public-pet-list'), params)

    def pet(self, pk):
        return self.get(reverse('public-pet-detail', args=[pk]))

    def browse(self, **params):
        return self.app.get(reverse('pet-list'), params)

    def ids(self, r):
        return [pet['id'] for pet in r.data['results']]

    def test_list_and_detail_need_a_key(self):
        for url in [reverse('public-pet-list'), reverse('public-pet-detail', args=[self.karo.pk])]:
            with self.subTest(url=url):
                r = self.get(url, key=False)
                self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
                self.assertEqual(r.data['error'], 'not_authenticated')

    def test_list_is_paginated_by_six(self):
        for n in range(5):
            make_pet(self.alice, name=f'Extra{n}')
        r = self.pets()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 8)
        self.assertEqual(len(r.data['results']), 6)
        self.assertIsNotNone(r.data['next'])
        self.assertIsNone(r.data['previous'])
        self.assertEqual(len(self.pets(page=2).data['results']), 2)

    def test_each_filter_gives_the_same_pets_as_browse(self):
        cases = {
            'species': 'cat', 'sex': 'female', 'size': 'large', 'age_bucket': 'under_1', 'city': 'Gdańsk',
            'breed': 'Poodle', 'trait': 'wild', 'vaccinated': 'true', 'neutered': 'false',
        }
        self.assertEqual(set(cases), FILTERS)
        for name, value in cases.items():
            with self.subTest(filter=name):
                r = self.pets(**{name: value})
                self.assertEqual(r.status_code, status.HTTP_200_OK)
                self.assertEqual(self.ids(r), self.ids(self.browse(**{name: value})))
                # The filter really narrowed the list: some of the three pets, not all of them.
                self.assertIn(len(self.ids(r)), [1, 2])

    def test_bad_filter_value_is_400(self):
        r = self.pets(species='bird', age_bucket='old', vaccinated='maybe')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r.data['error'], 'validation_failed')
        self.assertEqual(set(r.data['fields']), {'species', 'age_bucket', 'vaccinated'})

    def test_list_and_detail_have_exactly_the_public_fields(self):
        for pet in self.pets().data['results']:
            self.assertEqual(set(pet), PUBLIC_FIELDS)
        self.assertEqual(set(self.pet(self.karo.pk).data), PUBLIC_FIELDS)

    def test_is_adopted_is_true_only_for_an_adopted_pet(self):
        Pet.objects.filter(pk=self.kobi.pk).update(adopted_by=self.alice)
        listed = {pet['id']: pet['is_adopted'] for pet in self.pets().data['results']}
        self.assertEqual(listed, {str(self.karo.pk): False, str(self.kobi.pk): True, str(self.max.pk): False})
        self.assertIs(self.pet(self.kobi.pk).data['is_adopted'], True)
        self.assertIs(self.pet(self.karo.pk).data['is_adopted'], False)

    def test_detail_of_an_existing_pet(self):
        r = self.pet(self.karo.pk)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['id'], str(self.karo.pk))
        self.assertEqual(r.data['name'], 'Karo')

    def test_unknown_deleted_or_malformed_id_is_404(self):
        deleted = self.max.pk
        self.max.delete()
        for pk in [uuid.uuid4(), deleted, 'not-a-uuid']:
            with self.subTest(pk=pk):
                r = self.pet(pk)
                self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
                self.assertEqual(r.data['error'], 'not_found')


class PublicSchemaTests(APITestCase):

    def schema(self):
        r = self.client.get(reverse('public-schema'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.data

    def list_parameters(self):
        parameters = self.schema()['paths']['/api/public/v1/pets/']['get']['parameters']
        return {parameter['name']: parameter for parameter in parameters}

    def test_schema_is_open_openapi_3_with_only_public_paths(self):
        schema = self.schema()
        self.assertTrue(schema['openapi'].startswith('3.'))
        self.assertEqual(schema['info']['title'], 'Pawfect Match Public API')
        self.assertEqual(schema['info']['version'], 'v1')
        self.assertEqual(set(schema['paths']), PUBLIC_PATHS)

    def test_pets_list_documents_every_filter(self):
        parameters = self.list_parameters()
        self.assertEqual(set(parameters), FILTERS | {'q', 'page'})
        for parameter in parameters.values():
            self.assertEqual(parameter['in'], 'query')
            self.assertTrue(parameter['description'])
        # Spectacular sorts enum values.
        self.assertEqual(parameters['species']['schema']['enum'], ['cat', 'dog'])
        self.assertEqual(parameters['vaccinated']['schema']['type'], 'boolean')

    def test_documented_filters_match_the_browse_filters(self):
        self.assertEqual(set(self.list_parameters()) - {'page'}, set(PetFilterSerializer().fields))

    def test_every_operation_requires_the_api_key(self):
        schema = self.schema()
        self.assertEqual(schema['components']['securitySchemes']['ApiKeyAuth'],
                         {'type': 'apiKey', 'in': 'header', 'name': 'X-API-Key'})
        for path in PUBLIC_PATHS:
            with self.subTest(path=path):
                self.assertEqual(schema['paths'][path]['get']['security'], [{'ApiKeyAuth': []}])

    def test_docs_page_is_open(self):
        r = self.client.get(reverse('public-docs'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertContains(r, 'swagger-ui')
