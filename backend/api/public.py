from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import FixedPagePagination
from pets.browse import filter_pets, visible_pets
from pets.models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS
from pets.services import create_pet, delete_pet, update_pet

from .authentication import APIKeyAuthentication
from .schema import PET_BODY, PET_FILTERS, errors
from .serializers import PublicPetSerializer
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
    @extend_schema(responses={200: OpenApiTypes.OBJECT, **errors(401, 429)})
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


# Same rows, filters, order and page size as the app's Browse (pets/browse.py), with the public field set.
# Writes go through pets/services.py (the app's rules and side effects), acting as the key's owner.
# No partial_update, so the router maps no PATCH and DRF answers it with 405.
# PublicAPIView comes first so its key auth, permission and throttle are the ones used.
class PublicPetViewSet(PublicAPIView, viewsets.GenericViewSet):
    serializer_class = PublicPetSerializer
    pagination_class = FixedPagePagination

    def get_queryset(self):
        return visible_pets()

    # GET /api/public/v1/pets/?q=&species=&sex=&size=&age_bucket=&city=&breed=&trait=&vaccinated=&neutered=&page=
    @extend_schema(parameters=PET_FILTERS, responses={200: PublicPetSerializer, **errors(400, 401, 429)})
    def list(self, request):
        page = self.paginate_queryset(filter_pets(self.get_queryset(), request.query_params))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    # POST /api/public/v1/pets/ (JSON, or multipart with a photo; the key's owner becomes the pet's owner)
    @extend_schema(request=PET_BODY, responses={201: PublicPetSerializer, **errors(400, 401, 429)})
    def create(self, request):
        pet = create_pet(request.user, request.data, context=self.get_serializer_context())
        return Response(self.get_serializer(pet).data, status=status.HTTP_201_CREATED)

    # GET /api/public/v1/pets/{id}/ (DRF's get_object_or_404 also answers a malformed id with 404, not 500)
    @extend_schema(responses={200: PublicPetSerializer, **errors(401, 404, 429)})
    def retrieve(self, request, pk=None):
        pet = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(self.get_serializer(pet).data)

    # PUT /api/public/v1/pets/{id}/ (replaces the whole listing; owner only, an adopted pet is locked)
    @extend_schema(request=PET_BODY, responses={200: PublicPetSerializer, **errors(400, 401, 403, 404, 429)})
    def update(self, request, pk=None):
        pet = update_pet(get_object_or_404(self.get_queryset(), pk=pk), request.user, request.data,
                         context=self.get_serializer_context())
        return Response(self.get_serializer(pet).data)

    # DELETE /api/public/v1/pets/{id}/ (owner only)
    @extend_schema(responses={204: None, **errors(401, 403, 404, 429)})
    def destroy(self, request, pk=None):
        delete_pet(get_object_or_404(self.get_queryset(), pk=pk), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
