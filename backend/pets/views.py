from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics import signals as analytics_signals

from core.pagination import FixedPagePagination
from core.realtime import push
from inquiries.models import Attachment
from inquiries.serializers import AdoptSerializer, InquirySerializer
from inquiries.services import complete_adoption, newest_first, start_inquiry
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
    mixins.DestroyModelMixin,
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

    # GET /pets/{id}/
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        analytics_signals.pet_viewed.send(sender=self.__class__, user=request.user, pet=instance)
        return Response(self.get_serializer(instance).data)

    # POST /pets/
    def perform_create(self, serializer):
        pet = serializer.save(owner=self.request.user)
        analytics_signals.listing_published.send(sender=self.__class__, user=self.request.user, pet=pet)
        notify(pet.owner, 'create', 'Listing published', f'{pet.name} is now listed for adoption.', subject=pet)
        # TODO(B8): push pet.published to browse

    # DELETE /pets/{id}/ (owner only; adopters are notified first, while their threads still exist)
    def perform_destroy(self, pet):
        if pet.owner != self.request.user:
            raise PermissionDenied('Only the owner can remove this listing.')
        for inquiry in pet.inquiries.select_related('adopter'):
            notify(inquiry.adopter, 'delete', 'Listing removed',
                   f'{pet.owner.full_name} removed the listing for {pet.name}, so your adoption conversation was closed.')
        files = [attachment.file for attachment in Attachment.objects.filter(message__inquiry__pet=pet)]
        if pet.photo:
            files.append(pet.photo)
        pet_id = str(pet.pk)
        pet.delete()
        for file in files:
            file.delete(save=False)
        for group in (f'pet.{pet_id}', 'browse'):
            push(group, 'pet.removed', pet_id=pet_id)

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
