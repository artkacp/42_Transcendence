from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics import signals as analytics_signals

from core.pagination import FixedPagePagination
from inquiries.serializers import AdoptSerializer, InquirySerializer
from inquiries.services import complete_adoption, newest_first, start_inquiry

from .browse import filter_pets, visible_pets
from .models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS
from .serializers import PetSerializer
from .services import create_pet, delete_pet, update_pet


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
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PetSerializer
    pagination_class = FixedPagePagination

    def get_queryset(self):
        return visible_pets()

    # GET /pets/{id}/
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        analytics_signals.pet_viewed.send(sender=self.__class__, user=request.user, pet=instance)
        return Response(self.get_serializer(instance).data)

    # POST /pets/ (rules and side effects in pets/services.py)
    def create(self, request, *args, **kwargs):
        pet = create_pet(request.user, request.data, context=self.get_serializer_context())
        return Response(self.get_serializer(pet).data, status=status.HTTP_201_CREATED)

    # PUT / PATCH /pets/{id}/ (owner only; an adopted listing is locked; partial_update passes partial=True)
    def update(self, request, *args, **kwargs):
        pet = update_pet(self.get_object(), request.user, request.data, partial=kwargs.pop('partial', False),
                         context=self.get_serializer_context())
        return Response(self.get_serializer(pet).data)

    # DELETE /pets/{id}/ (owner only)
    def destroy(self, request, *args, **kwargs):
        delete_pet(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET /pets/?q=&species=&sex=&size=&age_bucket=&city=&breed=&trait=&vaccinated=&neutered=&page=
    def list(self, request):
        page = self.paginate_queryset(filter_pets(self.get_queryset(), request.query_params))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    # GET /pets/mine/
    @action(detail=False, methods=['get'])
    def mine(self, request):
        pets = self.get_queryset().filter(owner=request.user)
        return Response(self.get_serializer(pets, many=True).data)

    # GET /pets/{id}/inquiries/ (owner inbox)  ·  POST /pets/{id}/inquiries/ (start adoption)
    @action(detail=True, methods=['get', 'post'])
    def inquiries(self, request, pk=None):
        pet = self.get_object()
        context = self.get_serializer_context()
        if request.method == 'POST':
            inquiry, created = start_inquiry(pet, request.user)
            return Response(
                InquirySerializer(inquiry, context=context).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )

        if pet.owner != request.user:
            raise PermissionDenied('Only the owner can see the inquiries for this pet.')
        inquiries = newest_first(pet.inquiries.select_related('pet__owner', 'adopter'))
        return Response(InquirySerializer(inquiries, many=True, context=context).data)

    # POST /pets/{id}/adopt/ {inquiry_id}
    @action(detail=True, methods=['post'])
    def adopt(self, request, pk=None):
        data = AdoptSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        pet = complete_adoption(self.get_object(), request.user, data.validated_data['inquiry_id'])
        return Response(self.get_serializer(pet).data)
