from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from analytics import signals as analytics_signals
from core.realtime import push
from inquiries.models import Attachment
from notifications.services import notify

from .serializers import PetSerializer


# Shared by the app API (JWT) and the public API (X-API-Key). Pass the caller's serializer context so
# the photo and owner avatar URLs in the browse broadcast are absolute; without it they are relative / null.
def create_pet(owner, data, context=None):
    serializer = PetSerializer(data=data, context=context or {})
    serializer.is_valid(raise_exception=True)
    pet = serializer.save(owner=owner)
    analytics_signals.listing_published.send(sender=None, user=owner, pet=pet)
    notify(owner, 'create', 'Listing published', f'{pet.name} is now listed for adoption.', subject=pet)
    push('browse', 'pet.published', pet=serializer.data)
    return pet


# Owner only; an adopted listing is locked. Both are checked before the body is validated, so a
# non-owner gets 403 whatever they send.
def update_pet(pet, user, data, partial=False, context=None):
    if pet.owner != user:
        raise PermissionDenied('Only the owner can edit this listing.')
    if pet.adopted_by_id:
        raise PermissionDenied('An adopted listing can no longer be edited.')
    serializer = PetSerializer(pet, data=data, partial=partial, context=context or {})
    serializer.is_valid(raise_exception=True)
    old_photo = pet.photo.name
    pet = serializer.save()
    if old_photo and pet.photo.name != old_photo:
        # Only once the new row is committed: a rolled-back update must keep pointing at an existing file
        storage = pet.photo.storage
        transaction.on_commit(lambda: storage.delete(old_photo))
    return pet


# Owner only; adopters are notified first, while their threads still exist
def delete_pet(pet, user):
    if pet.owner != user:
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
