from django.db.models import Count
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import FixedPagePagination
from notifications.services import notify

from .models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS, Pet
from .serializers import PetFilterSerializer, PetSerializer

LOOKUPS = {
    'q': 'search_text__icontains',
    'age_bucket': 'age_years__range',
    'trait': 'traits__contains',
    'vaccinated': 'is_vaccinated',
    'neutered': 'is_neutered',
}


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


class PetViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PetSerializer
    pagination_class = FixedPagePagination

    def get_queryset(self):
        return (
            Pet.objects.select_related('owner', 'adopted_by')
            .annotate(inquiry_count=Count('inquiries'))
            .order_by('-created_at')
        )

    # POST /pets/
    def perform_create(self, serializer):
        pet = serializer.save(owner=self.request.user)
        notify(pet.owner, 'create', 'Listing published', f'{pet.name} is now listed for adoption.', subject=pet)
        # TODO(B8, A2): push pet.published to browse, track listing_published on commit

    # GET /pets/?q=&species=&sex=&size=&age_bucket=&city=&breed=&trait=&vaccinated=&neutered=&page=
    def list(self, request):
        # .dict() because DRF treats booleans missing from a QueryDict as False
        filters = PetFilterSerializer(data=request.query_params.dict())
        filters.is_valid(raise_exception=True)
        queryset = self.get_queryset()
        for name, value in filters.validated_data.items():
            if name == 'age_bucket':
                value = AGE_BUCKETS[value]
            elif name == 'trait':
                value = [value]
            queryset = queryset.filter(**{LOOKUPS.get(name, name): value})
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    # GET /pets/mine/
    @action(detail=False, methods=['get'])
    def mine(self, request):
        pets = self.get_queryset().filter(owner=request.user)
        return Response(self.get_serializer(pets, many=True).data)
