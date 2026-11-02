import tempfile

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection, transaction
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests import auth, image_file, make_pet, make_user
from inquiries.models import Inquiry

from .models import AGE_BUCKETS, BREEDS, CITIES, TRAITS, Pet
from .services import update_pet


def search_text_in_db(pet):
    with connection.cursor() as cursor:
        cursor.execute('SELECT search_text FROM pets_pet WHERE id = %s', [pet.pk])
        return cursor.fetchone()[0]


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


PET_PAYLOAD = {
    'name': 'Karo',
    'species': 'dog',
    'breed': 'Poodle',
    'age_years': 2,
    'size': 'small',
    'sex': 'male',
    'city': 'Kraków',
    'story': 'A friendly and energetic puppy.',
    'traits': ['friendly', 'playful'],
    'is_vaccinated': True,
}


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class PublishTests(APITestCase):
    payload = PET_PAYLOAD

    def setUp(self):
        self.alice = make_user('alice', 1)
        auth(self.client, self.alice)

    def publish(self, **overrides):
        return self.client.post(reverse('pet-list'), {**self.payload, **overrides}, format='multipart')

    def test_publish_creates_pet_with_search_text(self):
        r = self.publish(photo=image_file('karo.png'))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['owner']['handle'], 'alice')
        self.assertTrue(r.data['photo'].startswith('http'))
        self.assertRegex(Pet.objects.get().photo.name, r'^pets/[0-9a-f]{32}\.png$')
        self.assertEqual(r.data['traits'], ['friendly', 'playful'])
        self.assertEqual(search_text_in_db(Pet.objects.get()), 'Karo Poodle friendly playful')

    def test_publish_without_photo(self):
        r = self.publish()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(r.data['photo'])

    def test_breed_of_wrong_species_rejected(self):
        r = self.publish(species='cat')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('breed', r.data['fields'])
        self.assertFalse(Pet.objects.exists())

    def test_values_outside_vocabularies_rejected_per_field(self):
        r = self.publish(
            name='K', species='bird', breed='Dragon', age_years=21, size='huge', sex='other',
            city='Paris', story='Too short', traits=['dragon'],
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            set(r.data['fields']),
            {'name', 'species', 'breed', 'age_years', 'size', 'sex', 'city', 'story', 'traits'},
        )
        self.assertFalse(Pet.objects.exists())

    def test_more_than_four_traits_rejected(self):
        r = self.publish(traits=['friendly', 'playful', 'calm', 'shy', 'loyal'])
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('traits', r.data['fields'])

    def test_photo_rejects_non_image(self):
        r = self.publish(photo=SimpleUploadedFile('notes.txt', b'hello', content_type='text/plain'))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', r.data['fields'])

    def test_photo_rejects_disallowed_content_type(self):
        r = self.publish(photo=image_file('small.bmp', format='BMP'))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', r.data['fields'])

    def test_photo_rejects_file_over_5mb(self):
        r = self.publish(photo=image_file('big.bmp', size=(1400, 1400), format='BMP'))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', r.data['fields'])

    def test_search_text_follows_every_update(self):
        pet = make_pet(self.alice, name='Karo', breed='Poodle', traits=['calm'])
        self.assertEqual(search_text_in_db(pet), 'Karo Poodle calm')
        pet.name = 'Kobi'
        pet.traits = ['wild', 'shy']
        pet.save()
        self.assertEqual(search_text_in_db(pet), 'Kobi Poodle wild shy')


class BrowseTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        auth(self.client, self.alice)
        make_pet(self.alice, name='Karo', species='dog', breed='Poodle', age_years=0, size='small',
                 sex='male', city='Kraków', traits=['friendly'], is_vaccinated=True)
        make_pet(self.bob, name='Kobi', species='cat', breed='Maine Coon', age_years=3, size='medium',
                 sex='female', city='Gdańsk', traits=['wild', 'cuddly'], is_neutered=True)
        make_pet(self.bob, name='Max', species='dog', breed='German Shepherd', age_years=9, size='large',
                 sex='male', city='Gdańsk', traits=['loyal'])

    def browse(self, **params):
        return self.client.get(reverse('pet-list'), params)

    def names(self, r):
        return [pet['name'] for pet in r.data['results']]

    def test_list_is_newest_first_and_paginated_by_six(self):
        for n in range(5):
            make_pet(self.alice, name=f'Extra{n}')
        r = self.browse()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 8)
        self.assertEqual(len(r.data['results']), 6)
        self.assertEqual(self.names(r)[0], 'Extra4')
        self.assertIsNotNone(r.data['next'])
        self.assertEqual(self.names(self.browse(page=2)), ['Kobi', 'Karo'])

    def test_search_is_case_insensitive_substring_over_name_breed_and_traits(self):
        self.assertEqual(self.names(self.browse(q='ARO')), ['Karo'])
        self.assertEqual(self.names(self.browse(q='maine')), ['Kobi'])
        self.assertEqual(self.names(self.browse(q='cudd')), ['Kobi'])
        self.assertEqual(self.names(self.browse(q='zzz')), [])

    def test_each_filter(self):
        cases = {
            'species': ('cat', ['Kobi']),
            'sex': ('female', ['Kobi']),
            'size': ('large', ['Max']),
            'age_bucket': ('under_1', ['Karo']),
            'city': ('Gdańsk', ['Max', 'Kobi']),
            'breed': ('Poodle', ['Karo']),
            'trait': ('wild', ['Kobi']),
            'vaccinated': ('true', ['Karo']),
            'neutered': ('false', ['Max', 'Karo']),
        }
        for name, (value, expected) in cases.items():
            with self.subTest(filter=name):
                r = self.browse(**{name: value})
                self.assertEqual(r.status_code, status.HTTP_200_OK)
                self.assertEqual(self.names(r), expected)
                self.assertEqual(r.data['count'], len(expected))

    def test_age_buckets_cover_ranges(self):
        self.assertEqual(self.names(self.browse(age_bucket='1_3')), ['Kobi'])
        self.assertEqual(self.names(self.browse(age_bucket='4_7')), [])
        self.assertEqual(self.names(self.browse(age_bucket='8_plus')), ['Max'])

    def test_filters_combine_with_search_and_each_other(self):
        self.assertEqual(self.names(self.browse(species='dog', city='Gdańsk')), ['Max'])
        self.assertEqual(self.names(self.browse(q='k', species='dog')), ['Karo'])
        self.assertEqual(self.names(self.browse(q='k', species='dog', city='Gdańsk')), [])

    def test_unknown_filter_value_rejected(self):
        r = self.browse(species='bird', age_bucket='old', vaccinated='maybe')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(r.data['fields']), {'species', 'age_bucket', 'vaccinated'})
    
    def test_ordering(self):
        make_pet(self.alice, name='Ada', age_years=5)
        cases = {
            '-created_at': ['Ada', 'Max', 'Kobi', 'Karo'],
            'created_at': ['Karo', 'Kobi', 'Max', 'Ada'],
            'name': ['Ada', 'Karo', 'Kobi', 'Max'],
            'age_years': ['Karo', 'Kobi', 'Ada', 'Max'],
            '-age_years': ['Max', 'Ada', 'Kobi', 'Karo'],
        }
        for ordering, expected in cases.items():
            with self.subTest(ordering=ordering):
                self.assertEqual(self.names(self.browse(ordering=ordering)), expected)

    def test_unknown_ordering_rejected(self):
        r = self.browse(ordering='price')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(r.data['fields']), {'ordering'})


class MineAndDetailTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        self.carol = make_user('carol', 3)
        auth(self.client, self.alice)

    def test_mine_returns_own_listings_with_inquiry_counts_and_adopted_state(self):
        karo = make_pet(self.alice, name='Karo')
        kobi = make_pet(self.alice, name='Kobi', adopted_by=self.bob)
        make_pet(self.bob, name='Max')
        Inquiry.objects.create(pet=karo, adopter=self.bob)
        Inquiry.objects.create(pet=karo, adopter=self.carol)
        Inquiry.objects.create(pet=kobi, adopter=self.bob)
        r = self.client.get(reverse('pet-mine'))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        by_name = {pet['name']: pet for pet in r.data}
        self.assertEqual(set(by_name), {'Karo', 'Kobi'})
        self.assertEqual(by_name['Karo']['inquiry_count'], 2)
        self.assertIsNone(by_name['Karo']['adopted_by'])
        self.assertEqual(by_name['Kobi']['inquiry_count'], 1)
        self.assertEqual(by_name['Kobi']['adopted_by']['handle'], 'bob')

    def test_detail_includes_owner_card_and_adoption_state(self):
        pet = make_pet(self.bob, adopted_by=self.carol)
        r = self.client.get(reverse('pet-detail', args=[pet.pk]))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['owner']['handle'], 'bob')
        self.assertEqual(r.data['adopted_by']['handle'], 'carol')
        self.assertIn('is_online', r.data['owner'])

    def test_pets_require_authentication(self):
        self.client.credentials()
        r = self.client.get(reverse('pet-list'))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class UpdateTests(APITestCase):

    def setUp(self):
        self.alice = make_user('alice', 1)
        self.bob = make_user('bob', 2)
        self.pet = make_pet(self.alice)
        auth(self.client, self.alice)

    def put(self, **overrides):
        return self.client.put(reverse('pet-detail', args=[self.pet.pk]), {**PET_PAYLOAD, **overrides}, format='json')

    def patch(self, data, format='json'):
        return self.client.patch(reverse('pet-detail', args=[self.pet.pk]), data, format=format)

    def test_owner_replaces_the_listing_with_put(self):
        r = self.put(name='Kobi', traits=['calm'])
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['name'], 'Kobi')
        self.assertEqual(r.data['owner']['handle'], 'alice')
        self.assertEqual(search_text_in_db(self.pet), 'Kobi Poodle calm')

    def test_owner_patches_a_single_field(self):
        r = self.patch({'city': 'Gdańsk'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.city, 'Gdańsk')
        self.assertEqual(self.pet.name, 'Karo')
        self.assertEqual(self.pet.owner.notifications.get().title, 'Listing updated')

    def test_non_owner_gets_403(self):
        auth(self.client, self.bob)
        self.assertEqual(self.put(name='Kobi').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.patch({'name': 'Kobi'}).status_code, status.HTTP_403_FORBIDDEN)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.name, 'Karo')

    def test_adopted_listing_is_locked(self):
        Pet.objects.filter(pk=self.pet.pk).update(adopted_by=self.bob)
        self.assertEqual(self.patch({'name': 'Kobi'}).status_code, status.HTTP_403_FORBIDDEN)

    def test_breed_is_rechecked_when_species_changes(self):
        r = self.patch({'species': 'cat'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('breed', r.data['fields'])
        self.assertEqual(self.patch({'breed': 'Maine Coon'}).status_code, status.HTTP_400_BAD_REQUEST)
        r = self.patch({'species': 'cat', 'breed': 'Maine Coon'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['species'], 'cat')

    def test_new_photo_replaces_the_old_file(self):
        old = self.patch({'photo': image_file('karo.png')}, format='multipart')
        old_name = Pet.objects.get().photo.name
        self.assertEqual(old.status_code, status.HTTP_200_OK)
        with self.captureOnCommitCallbacks(execute=True):
            self.patch({'photo': image_file('kobi.png')}, format='multipart')
        self.assertFalse(default_storage.exists(old_name))
        self.assertTrue(default_storage.exists(Pet.objects.get().photo.name))

    def test_multipart_saves_text_and_photo_together(self):
        r = self.patch({'name': 'Kobi', 'photo': image_file('kobi.png')}, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.name, 'Kobi')
        self.assertTrue(self.pet.photo)

    def test_rejected_photo_saves_no_text(self):
        bad = SimpleUploadedFile('notes.png', b'hello', content_type='image/png')
        r = self.patch({'name': 'Kobi', 'photo': bad}, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.name, 'Karo')

    def test_multipart_blank_photo_removes_the_file(self):
        self.patch({'photo': image_file('karo.png')}, format='multipart')
        old_name = Pet.objects.get().photo.name
        with self.captureOnCommitCallbacks(execute=True):
            r = self.patch({'photo': ''}, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data['photo'])
        self.assertFalse(default_storage.exists(old_name))

    def test_multipart_traits_can_be_emptied_or_left_alone(self):
        self.patch({'traits': ['calm', 'shy']}, format='multipart')
        self.patch({'name': 'Kobi'}, format='multipart')
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.traits, ['calm', 'shy'])
        r = self.patch({'traits': ''}, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.traits, [])

    def test_non_owner_or_adopted_with_invalid_body_gets_403(self):
        auth(self.client, self.bob)
        self.assertEqual(self.put(name='K').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.patch({'species': 'bird'}).status_code, status.HTTP_403_FORBIDDEN)
        auth(self.client, self.alice)
        Pet.objects.filter(pk=self.pet.pk).update(adopted_by=self.bob)
        self.assertEqual(self.patch({'species': 'bird'}).status_code, status.HTTP_403_FORBIDDEN)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.name, 'Karo')

    def test_old_photo_is_kept_when_the_update_fails(self):
        self.patch({'photo': image_file('karo.png')}, format='multipart')
        old_name = Pet.objects.get().photo.name

        # Rejected by validation: nothing is saved
        r = self.patch({'photo': image_file('kobi.png'), 'name': 'K'}, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(default_storage.exists(old_name))

        # Saved, then rolled back with the surrounding transaction: the on_commit delete is discarded
        with self.captureOnCommitCallbacks(execute=True), self.assertRaises(RuntimeError), transaction.atomic():
            update_pet(Pet.objects.get(), self.alice, {'photo': image_file('kobi.png')}, partial=True)
            raise RuntimeError('rolled back')
        self.assertEqual(Pet.objects.get().photo.name, old_name)
        self.assertTrue(default_storage.exists(old_name))
