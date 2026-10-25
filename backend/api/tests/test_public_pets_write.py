import tempfile
import uuid
from unittest.mock import ANY, patch

from django.core.cache import caches
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.tests import auth, image_file, make_pet, make_user
from notifications.models import Notification
from pets.models import Pet
from pets.serializers import PetSerializer
from pets.tests import PET_PAYLOAD

from ..schema import PetUploadSerializer
from .test_public_auth import make_key
from .test_public_pets import PUBLIC_FIELDS

LIST = '/api/public/v1/pets/'
DETAIL = '/api/public/v1/pets/{id}/'


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class PublicPetWriteTests(APITestCase):

    def setUp(self):
        caches['throttle'].clear()
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        self.key, self.full_key = make_key(self.alice)
        self.mine = make_pet(self.alice, name='Karo')
        self.bobs = make_pet(self.bob, name='Max')

    def send(self, method, url, data=None, format='json', key=True):
        headers = {'HTTP_X_API_KEY': self.full_key} if key else {}
        return getattr(self.client, method)(url, data, format=format, **headers)

    def post(self, data=PET_PAYLOAD, **kwargs):
        return self.send('post', reverse('public-pet-list'), data, **kwargs)

    def put(self, pet, **overrides):
        return self.send('put', reverse('public-pet-detail', args=[pet.pk]), {**PET_PAYLOAD, **overrides})

    def delete(self, pk):
        return self.send('delete', reverse('public-pet-detail', args=[pk]))

    # Runs one publish request and checks what it triggered: the owner's notification, the analytics
    # event written on commit and the browse broadcast. Returns the broadcast pet.
    def assert_publish_side_effects(self, send):
        with patch('analytics.handlers._write_event') as write_event, patch('pets.services.push') as push, \
                self.captureOnCommitCallbacks(execute=True):
            r = send()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        pet = Pet.objects.get(pk=r.data['id'])
        self.assertEqual(
            [(n.recipient, n.kind, n.title) for n in Notification.objects.filter(subject_id=pet.pk)],
            [(self.alice, 'create', 'Listing published')],
        )
        write_event.assert_called_once_with(self.alice.id, pet.id, 'listing_published', ANY)
        push.assert_called_once_with('browse', 'pet.published', pet=ANY)
        broadcast = push.call_args.kwargs['pet']
        self.assertEqual(broadcast['id'], str(pet.pk))
        return broadcast

    def test_post_creates_a_pet_owned_by_the_key_owner(self):
        r = self.post()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(r.data), PUBLIC_FIELDS)
        self.assertEqual(Pet.objects.get(pk=r.data['id']).owner, self.alice)
        self.assertIs(r.data['is_adopted'], False)

    def test_post_multipart_with_a_photo(self):
        r = self.post({**PET_PAYLOAD, 'photo': image_file('karo.png')}, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r.data['photo'].startswith('http'))
        self.assertRegex(Pet.objects.get(pk=r.data['id']).photo.name, r'^pets/[0-9a-f]{32}\.png$')

    def test_post_has_the_same_side_effects_as_the_app_post(self):
        app = APIClient()
        auth(app, self.alice)
        from_app = self.assert_publish_side_effects(lambda: app.post(reverse('pet-list'), PET_PAYLOAD, format='json'))
        from_public = self.assert_publish_side_effects(self.post)
        # Browse subscribers get the app's full pet card either way
        self.assertEqual(set(from_public), set(from_app))
        self.assertEqual(from_public['owner']['handle'], 'alice')

    def test_post_invalid_body_is_400(self):
        r = self.post({**PET_PAYLOAD, 'species': 'bird', 'story': 'Too short'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r.data['error'], 'validation_failed')
        self.assertEqual(set(r.data['fields']), {'species', 'story'})
        self.assertEqual(Pet.objects.count(), 2)

    def test_post_without_a_key_is_401(self):
        r = self.post(key=False)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Pet.objects.count(), 2)

    def test_put_own_pet_replaces_it(self):
        r = self.put(self.mine, name='Kobi', city='Gdańsk', traits=['calm'])
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(set(r.data), PUBLIC_FIELDS)
        self.mine.refresh_from_db()
        self.assertEqual((self.mine.name, self.mine.city, self.mine.traits), ('Kobi', 'Gdańsk', ['calm']))

    def test_put_someone_elses_pet_is_403(self):
        r = self.put(self.bobs, name='Kobi')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(r.data['error'], 'permission_denied')
        self.bobs.refresh_from_db()
        self.assertEqual(self.bobs.name, 'Max')

    def test_put_adopted_pet_is_403(self):
        Pet.objects.filter(pk=self.mine.pk).update(adopted_by=self.bob)
        self.assertEqual(self.put(self.mine, name='Kobi').status_code, status.HTTP_403_FORBIDDEN)

    def test_put_breed_of_another_species_is_400(self):
        r = self.put(self.mine, species='cat')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('breed', r.data['fields'])

    def test_patch_is_405(self):
        r = self.send('patch', reverse('public-pet-detail', args=[self.mine.pk]), {'name': 'Kobi'})
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.mine.refresh_from_db()
        self.assertEqual(self.mine.name, 'Karo')

    def test_delete_own_pet(self):
        self.assertEqual(self.delete(self.mine.pk).status_code, status.HTTP_204_NO_CONTENT)
        listed = self.client.get(reverse('public-pet-list'), HTTP_X_API_KEY=self.full_key).data['results']
        self.assertEqual([pet['id'] for pet in listed], [str(self.bobs.pk)])

    def test_delete_someone_elses_pet_is_403(self):
        self.assertEqual(self.delete(self.bobs.pk).status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Pet.objects.filter(pk=self.bobs.pk).exists())

    def test_delete_unknown_pet_is_404(self):
        r = self.delete(uuid.uuid4())
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(r.data['error'], 'not_found')

    def test_revoked_key_cannot_write(self):
        self.key.revoked = True
        self.key.save(update_fields=['revoked'])
        detail = reverse('public-pet-detail', args=[self.mine.pk])
        for method, url, data in [('post', reverse('public-pet-list'), PET_PAYLOAD),
                                  ('put', detail, {**PET_PAYLOAD, 'name': 'Kobi'}),
                                  ('delete', detail, None)]:
            with self.subTest(method=method):
                r = self.send(method, url, data)
                self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
                self.assertEqual(r.data['detail'], 'API key revoked.')
        self.assertEqual(Pet.objects.count(), 2)
        self.mine.refresh_from_db()
        self.assertEqual(self.mine.name, 'Karo')


class PublicWriteSchemaTests(APITestCase):

    def setUp(self):
        self.schema = self.client.get(reverse('public-schema')).data

    def component(self, media):
        return self.schema['components']['schemas'][media['schema']['$ref'].rsplit('/', 1)[1]]

    def test_pets_paths_offer_post_put_delete_and_no_patch(self):
        self.assertEqual(set(self.schema['paths'][LIST]), {'get', 'post'})
        self.assertEqual(set(self.schema['paths'][DETAIL]), {'get', 'put', 'delete'})

    def test_every_operation_lists_its_responses_and_needs_the_key(self):
        expected = {
            (LIST, 'get'): {'200', '400', '401', '429'},
            (LIST, 'post'): {'201', '400', '401', '429'},
            (DETAIL, 'get'): {'200', '401', '404', '429'},
            (DETAIL, 'put'): {'200', '400', '401', '403', '404', '429'},
            (DETAIL, 'delete'): {'204', '401', '403', '404', '429'},
        }
        for (path, method), codes in expected.items():
            with self.subTest(path=path, method=method):
                operation = self.schema['paths'][path][method]
                self.assertEqual(set(operation['responses']), codes)
                self.assertEqual(operation['security'], [{'ApiKeyAuth': []}])

    def test_post_and_put_take_json_or_multipart_with_a_binary_photo(self):
        for path, method in [(LIST, 'post'), (DETAIL, 'put')]:
            with self.subTest(method=method):
                content = self.schema['paths'][path][method]['requestBody']['content']
                self.assertEqual(set(content), {'application/json', 'multipart/form-data'})
                json_body = self.component(content['application/json'])
                multipart = self.component(content['multipart/form-data'])
                self.assertNotIn('photo', json_body['properties'])
                self.assertEqual(multipart['properties']['photo']['format'], 'binary')
                self.assertEqual(set(multipart['required']),
                                 {'name', 'species', 'breed', 'age_years', 'size', 'sex', 'city', 'story'})
                self.assertEqual(json_body['properties']['story']['minLength'], 20)

    def test_documented_body_has_the_app_rules(self):
        def rules(field):
            child = getattr(field, 'child', None)
            return (
                type(field), field.required,
                getattr(field, 'min_length', None), getattr(field, 'max_length', None),
                getattr(field, 'min_value', None), getattr(field, 'max_value', None),
                getattr(field, 'choices', None), getattr(child, 'choices', None),
            )
        app = {name: rules(field) for name, field in PetSerializer().fields.items() if not field.read_only}
        documented = {name: rules(field) for name, field in PetUploadSerializer().fields.items()}
        self.assertEqual(documented, app)
