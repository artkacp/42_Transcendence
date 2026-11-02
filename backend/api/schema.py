from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse
from rest_framework import serializers

from pets.models import (
    AGE_BUCKETS,
    BREEDS,
    CITIES,
    MAX_STORY_LENGTH,
    ORDERINGS,
    SEX_CHOICES,
    SIZE_CHOICES,
    SPECIES_CHOICES,
    TRAITS,
)
from pets.serializers import TraitsField

PUBLIC_PREFIX = '/api/public/v1/'
ALL_BREEDS = [breed for breeds in BREEDS.values() for breed in breeds]


# SPECTACULAR_SETTINGS['PREPROCESSING_HOOKS']: drop every endpoint outside the public API.
# Each endpoint is (path, path_regex, method, view).
def public_endpoints_only(endpoints, **kwargs):
    return [endpoint for endpoint in endpoints if endpoint[0].startswith(PUBLIC_PREFIX)]


# Registered just by being defined (api/public.py imports this module). Spectacular then marks every
# view that authenticates with APIKeyAuthentication as needing the X-API-Key header.
class APIKeyScheme(OpenApiAuthenticationExtension):
    target_class = 'api.authentication.APIKeyAuthentication'
    name = 'ApiKeyAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'apiKey', 'in': 'header', 'name': 'X-API-Key'}


# filter_pets() validates these inside list(), where spectacular can't see them, so they are declared
# here, with values from the same vocabularies as /options/. `page` comes from the pagination class.
PET_FILTERS = [
    OpenApiParameter('q', str, description='Case-insensitive search in name, breed and traits.'),
    OpenApiParameter('species', str, enum=[value for value, _ in SPECIES_CHOICES],
                     description='Only pets of this species.'),
    OpenApiParameter('sex', str, enum=[value for value, _ in SEX_CHOICES], description='Only pets of this sex.'),
    OpenApiParameter('size', str, enum=[value for value, _ in SIZE_CHOICES], description='Only pets of this size.'),
    OpenApiParameter('age_bucket', str, enum=list(AGE_BUCKETS),
                     description='Age in whole years: under_1 = 0, 1_3 = 1 to 3, 4_7 = 4 to 7, 8_plus = 8 or more.'),
    OpenApiParameter('city', str, enum=CITIES, description='Only pets in this city.'),
    OpenApiParameter('breed', str, enum=ALL_BREEDS, description='Only pets of this breed (dog and cat breeds).'),
    OpenApiParameter('trait', str, enum=TRAITS, description='Only pets that have this trait.'),
    OpenApiParameter('vaccinated', bool, description='true: vaccinated pets only; false: unvaccinated pets only.'),
    OpenApiParameter('neutered', bool, description='true: neutered pets only; false: pets not neutered only.'),
    OpenApiParameter('ordering', str, enum=ORDERINGS,
                     description='Sort order: -created_at (newest first, the default), created_at, name, '
                                 'age_years (youngest first), -age_years (oldest first).'),
]

# POST and PUT bodies, for the docs only: pets.services validates every write with the app's
# PetSerializer. These repeat its rules; api/tests/test_public_pets_write.py fails if they drift apart.
class PetInputSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=100)
    species = serializers.ChoiceField(choices=SPECIES_CHOICES)
    breed = serializers.ChoiceField(choices=ALL_BREEDS, help_text='Must be a breed of the chosen species (see /options/).')
    age_years = serializers.IntegerField(min_value=0, max_value=20)
    size = serializers.ChoiceField(choices=SIZE_CHOICES)
    sex = serializers.ChoiceField(choices=SEX_CHOICES)
    city = serializers.ChoiceField(choices=CITIES)
    story = serializers.CharField(min_length=20, max_length=MAX_STORY_LENGTH)
    traits = TraitsField(child=serializers.ChoiceField(choices=TRAITS), max_length=4, required=False)
    is_vaccinated = serializers.BooleanField(required=False, help_text='Defaults to false.')
    is_neutered = serializers.BooleanField(required=False, help_text='Defaults to false.')


# Multipart only: JSON can't carry a file
class PetUploadSerializer(PetInputSerializer):
    photo = serializers.ImageField(required=False, help_text='An image of 5 MB or less.')


PET_BODY = {'application/json': PetInputSerializer, 'multipart/form-data': PetUploadSerializer}


# The error envelope from core/exceptions.py
class ErrorSerializer(serializers.Serializer):
    error = serializers.CharField(help_text='Machine-readable code, e.g. validation_failed, not_authenticated, '
                                            'permission_denied, not_found, throttled.')
    detail = serializers.CharField(help_text='Human-readable message.')

    # Declared here because a class attribute named `fields` would hide Serializer.fields
    def get_fields(self):
        fields = super().get_fields()
        fields['fields'] = serializers.DictField(required=False, help_text='validation_failed only: messages per field.')
        return fields


ERRORS = {
    400: OpenApiResponse(ErrorSerializer, description='Invalid input; `fields` has the messages per field.'),
    401: OpenApiResponse(ErrorSerializer, description='Missing, invalid or revoked API key.'),
    403: OpenApiResponse(ErrorSerializer, description="The pet isn't yours, or (PUT) it has already been adopted."),
    404: OpenApiResponse(ErrorSerializer, description='No pet with this id.'),
    429: OpenApiResponse(ErrorSerializer, description="Over this key's limit; retry after the seconds in Retry-After."),
}


def errors(*codes):
    return {code: ERRORS[code] for code in codes}
