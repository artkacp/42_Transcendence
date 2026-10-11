from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS


def values(choices):
    return [value for value, _ in choices]


class PetOptionsView(APIView):
    def get(self, request):
        return Response({
            'species': values(SPECIES_CHOICES),
            'breeds': BREEDS,
            'sizes': values(SIZE_CHOICES),
            'sexes': values(SEX_CHOICES),
            'cities': CITIES,
            'traits': TRAITS,
            'age_buckets': AGE_BUCKETS,
        })
