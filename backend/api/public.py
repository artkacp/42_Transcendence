from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from pets.models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS

from .authentication import APIKeyAuthentication
from .throttling import APIKeyRateThrottle


# Base for every /api/public/v1/ view: API keys only, never the app's JWT.
# DRF runs authentication, then permissions, then throttles, so a missing, invalid
# or revoked key is answered with 401 before any request counter is touched.
class PublicAPIView(APIView):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [APIKeyRateThrottle]


class PublicOptionsView(PublicAPIView):
    # GET /api/public/v1/options/ (the values the pet filters accept; same source as /api/pet-options/)
    def get(self, request):
        return Response({
            'species': [value for value, _ in SPECIES_CHOICES],
            'breeds': BREEDS,
            'sizes': [value for value, _ in SIZE_CHOICES],
            'sexes': [value for value, _ in SEX_CHOICES],
            'cities': CITIES,
            'traits': TRAITS,
            'age_buckets': AGE_BUCKETS,
        })
