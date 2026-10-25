from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.utils import OpenApiParameter

from pets.models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS

PUBLIC_PREFIX = '/api/public/v1/'


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
    OpenApiParameter('breed', str, enum=[breed for breeds in BREEDS.values() for breed in breeds],
                     description='Only pets of this breed (dog and cat breeds).'),
    OpenApiParameter('trait', str, enum=TRAITS, description='Only pets that have this trait.'),
    OpenApiParameter('vaccinated', bool, description='true: vaccinated pets only; false: unvaccinated pets only.'),
    OpenApiParameter('neutered', bool, description='true: neutered pets only; false: pets not neutered only.'),
]
