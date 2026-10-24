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

from .browse import filter_pets, visible_pets
from .models import AGE_BUCKETS, BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, SPECIES_CHOICES, TRAITS
from .serializers import PetSerializer


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

    # POST /pets/
    def perform_create(self, serializer):
        pet = serializer.save(owner=self.request.user)
        analytics_signals.listing_published.send(sender=self.__class__, user=self.request.user, pet=pet)
        notify(pet.owner, 'create', 'Listing published', f'{pet.name} is now listed for adoption.', subject=pet)
        push('browse', 'pet.published', pet=serializer.data)

    # PUT / PATCH /pets/{id}/ (owner only; an adopted listing is locked)
    def perform_update(self, serializer):
        pet = serializer.instance
        if pet.owner != self.request.user:
            raise PermissionDenied('Only the owner can edit this listing.')
        if pet.adopted_by_id:
            raise PermissionDenied('An adopted listing can no longer be edited.')
        old_photo = pet.photo.name
        pet = serializer.save()
        if old_photo and pet.photo.name != old_photo:
            pet.photo.storage.delete(old_photo)

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
