from datetime import timedelta

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404

from core.realtime import push
from notifications.services import notify

from .models import Attachment, Inquiry, Message
from .serializers import InquirySerializer, MessageSerializer


def participant_inquiries(user):
    return Inquiry.objects.filter(Q(adopter=user) | Q(pet__owner=user)).select_related('pet__owner', 'adopter')


def newest_first(inquiries):
    return inquiries.order_by(F('last_message_at').desc(nulls_last=True), '-created_at')


def start_inquiry(pet, adopter):
    if pet.owner == adopter:
        raise PermissionDenied('You cannot start an adoption for your own pet.')
    inquiry, created = Inquiry.objects.get_or_create(pet=pet, adopter=adopter)
    if created:
        notify(pet.owner, 'create', 'New adoption inquiry', f'{adopter.full_name} wants to adopt {pet.name}.', subject=inquiry)
        push(f'user.{pet.owner_id}', 'inquiry.created', inquiry=InquirySerializer(inquiry).data)
        # TODO(A2): track the application event on commit
    return inquiry, created


# Shared by the REST fallback and the WebSocket chat.send handler
def send_message(sender, inquiry_id, body, attachment_ids):
    inquiry = get_object_or_404(participant_inquiries(sender), pk=inquiry_id)
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
    # TODO(A2): track the message event on commit

    push(f'pet.{inquiry.pet_id}', 'chat.message', message=MessageSerializer(message).data)
    recipient = inquiry.pet.owner if sender == inquiry.adopter else inquiry.adopter
    notify(recipient, 'create', 'New message', f'{sender.full_name} wrote about {inquiry.pet.name}.', subject=inquiry)
    return message


def sweep_stale_attachments(user):
    stale = user.attachments.filter(message=None, created_at__lt=timezone.now() - timedelta(hours=24))
    for attachment in stale:
        attachment.file.delete(save=False)
    stale.delete()
