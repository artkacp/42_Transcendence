from datetime import timedelta

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404

from analytics import signals as analytics_signals
from core.realtime import push
from notifications.services import notify

from .models import Attachment, Inquiry, Message
from .serializers import InquirySerializer, MessageSerializer


def participant_inquiries(user):
    return Inquiry.objects.filter(Q(adopter=user) | Q(pet__owner=user)).select_related('pet__owner', 'adopter')


def newest_first(inquiries):
    return inquiries.order_by(F('last_message_at').desc(nulls_last=True), '-created_at')


def check_can_manage(pet, user):
    if pet.owner != user:
        raise PermissionDenied('Only the owner can manage this adoption.')
    if pet.adopted_by_id:
        raise PermissionDenied('This pet has already been adopted.')


def start_inquiry(pet, adopter):
    if pet.owner == adopter:
        raise PermissionDenied('You cannot start an adoption for your own pet.')
    if pet.adopted_by_id:
        raise PermissionDenied('This pet has already been adopted.')
    inquiry, created = Inquiry.objects.get_or_create(pet=pet, adopter=adopter)
    if created:
        notify(pet.owner, 'create', 'New adoption inquiry', f'{adopter.full_name} wants to adopt {pet.name}.', subject=inquiry)
        push(f'user.{pet.owner_id}', 'inquiry.created', inquiry=InquirySerializer(inquiry).data)
        analytics_signals.inquiry_opened.send(sender=None, user=adopter, pet=pet)
    return inquiry, created


# Shared by the REST fallback and the WebSocket chat.send handler
def send_message(sender, inquiry_id, body, attachment_ids):
    inquiry = get_object_or_404(participant_inquiries(sender), pk=inquiry_id)
    if inquiry.pet.adopted_by_id:
        raise PermissionDenied('This adoption is closed.')
    if not body and not attachment_ids:
        raise ValidationError({'body': 'A message needs text or at least one attachment.'})
    attachments = Attachment.objects.filter(pk__in=attachment_ids, uploaded_by=sender, message=None)
    if attachments.count() != len(set(attachment_ids)):
        raise ValidationError({'attachment_ids': 'Unknown or already sent attachment.'})

    with transaction.atomic():
        message = Message.objects.create(inquiry=inquiry, sender=sender, body=body)
        attachments.update(message=message)
        inquiry.last_message_at = message.created_at
        inquiry.save(update_fields=['last_message_at'])

    analytics_signals.message_sent.send(sender=None, user=sender, pet=inquiry.pet)
    for group in (f'user.{inquiry.pet.owner_id}', f'user.{inquiry.adopter_id}'):
        push(group, 'chat.message', message=MessageSerializer(message).data)
    recipient = inquiry.pet.owner if sender == inquiry.adopter else inquiry.adopter
    notify(recipient, 'create', 'New message', f'{sender.full_name} wrote about {inquiry.pet.name}.', subject=inquiry)
    return message


def change_stage(user, inquiry_id, stage):
    inquiry = get_object_or_404(Inquiry.objects.select_related('pet__owner', 'adopter'), pk=inquiry_id)
    pet = inquiry.pet
    check_can_manage(pet, user)
    inquiry.stage = stage
    inquiry.save(update_fields=['stage'])

    body = f"{inquiry.adopter.full_name}'s adoption of {pet.name} moved to {inquiry.get_stage_display()}."
    for party in (pet.owner, inquiry.adopter):
        notify(party, 'update', 'Adoption stage changed', body, subject=inquiry)
    for group in (f'user.{pet.owner_id}', f'user.{inquiry.adopter_id}'):
        push(group, 'inquiry.stage_changed', inquiry_id=str(inquiry.pk), stage=stage)
    return inquiry


def complete_adoption(pet, user, inquiry_id):
    check_can_manage(pet, user)
    inquiry = pet.inquiries.select_related('adopter').filter(pk=inquiry_id).first()
    if inquiry is None:
        raise ValidationError({'inquiry_id': 'This inquiry does not belong to this pet.'})
    pet.adopted_by = inquiry.adopter
    pet.adopted_at = timezone.now()
    pet.save(update_fields=['adopted_by', 'adopted_at'])
    analytics_signals.adoption_completed.send(sender=None, user=inquiry.adopter, pet=pet)

    body = f'{pet.name} was adopted by {inquiry.adopter.full_name}.'
    for party in (pet.owner, inquiry.adopter):
        notify(party, 'update', 'Adoption completed', body, subject=pet)
    for group in (f'pet.{pet.pk}', 'browse'):
        push(group, 'pet.adopted', pet_id=str(pet.pk), adopted_by_id=str(inquiry.adopter_id))
    for other in pet.inquiries.exclude(pk=inquiry.pk).select_related('adopter'):
        notify(other.adopter, 'update', 'Adopted by someone else', f'{pet.name} was adopted by someone else.', subject=pet)
    return pet


def sweep_stale_attachments(user):
    stale = user.attachments.filter(message=None, created_at__lt=timezone.now() - timedelta(hours=24))
    for attachment in stale:
        attachment.file.delete(save=False)
    stale.delete()
