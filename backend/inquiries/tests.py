import os
import tempfile
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests import auth, image_file, make_pet, make_user
from pets.models import Pet
from pets.services import delete_pet

from .models import MAX_MESSAGE_LENGTH, Attachment, Inquiry, Message


def listen(group):
    layer = get_channel_layer()
    channel = async_to_sync(layer.new_channel)()
    async_to_sync(layer.group_add)(group, channel)
    return lambda: async_to_sync(layer.receive)(channel)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class InquiryTestCase(APITestCase):

    def setUp(self):
        self.owner = make_user('owner', 1)
        self.adopter = make_user('adopter', 2)
        self.stranger = make_user('stranger', 3)
        self.pet = make_pet(self.owner)
        auth(self.client, self.adopter)

    def as_user(self, user):
        auth(self.client, user)

    def start(self):
        return self.client.post(reverse('pet-inquiries', args=[self.pet.pk]))

    def upload(self, file):
        return self.client.post(reverse('attachment-list'), {'file': file}, format='multipart')

    def send(self, inquiry, **data):
        return self.client.post(reverse('inquiry-messages', args=[inquiry.pk]), data, format='json')


class StartInquiryTests(InquiryTestCase):

    def test_second_inquiry_returns_the_existing_one(self):
        first = self.start()
        second = self.start()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(self.owner.notifications.filter(title='New adoption inquiry').count(), 1)

    def test_owner_is_told_with_an_inquiry_created_frame(self):
        receive = listen(f'user.{self.owner.pk}')
        r = self.start()
        frames = [receive(), receive()]
        created = next(f for f in frames if f['type'] == 'inquiry.created')
        self.assertEqual(created['inquiry']['id'], r.data['id'])

    def test_owner_cannot_inquire_on_own_pet(self):
        self.as_user(self.owner)
        r = self.start()
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Inquiry.objects.exists())

    def test_owner_inbox_and_adopter_threads(self):
        self.start()
        self.as_user(self.owner)
        inbox = self.client.get(reverse('pet-inquiries', args=[self.pet.pk]))
        self.assertEqual([i['adopter']['handle'] for i in inbox.data], ['adopter'])

        self.as_user(self.adopter)
        threads = self.client.get(reverse('inquiry-list'))
        self.assertEqual([i['pet']['name'] for i in threads.data], ['Karo'])

        self.as_user(self.stranger)
        r = self.client.get(reverse('pet-inquiries', args=[self.pet.pk]))
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class AttachmentTests(InquiryTestCase):

    def test_upload_stores_a_staged_attachment_under_a_generated_name(self):
        r = self.upload(image_file('photo.png'))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['kind'], 'image')
        self.assertEqual(r.data['original_name'], 'photo.png')
        attachment = Attachment.objects.get()
        self.assertIsNone(attachment.message)
        self.assertRegex(attachment.file.name, r'^attachments/[0-9a-f]{32}\.png$')

        r = self.upload(SimpleUploadedFile('notes.md', b'# hi'))
        self.assertEqual(r.data['kind'], 'document')
        self.assertEqual(r.data['content_type'], 'text/markdown')

    def test_disallowed_or_oversized_upload_writes_nothing(self):
        media = tempfile.mkdtemp()
        with self.settings(MEDIA_ROOT=media):
            for file in [
                SimpleUploadedFile('virus.exe', b'MZ'),
                SimpleUploadedFile('big.pdf', b'0' * (5 * 1024 * 1024 + 1)),
            ]:
                r = self.upload(file)
                self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('file', r.data['fields'])
        self.assertEqual(os.listdir(media), [])
        self.assertFalse(Attachment.objects.exists())

    def test_unstage_removes_own_staged_file_only(self):
        mine = Attachment.objects.get(pk=self.upload(image_file()).data['id'])
        r = self.client.delete(reverse('attachment-detail', args=[mine.pk]))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(default_storage.exists(mine.file.name))

        self.as_user(self.stranger)
        theirs = self.upload(image_file()).data['id']
        self.as_user(self.adopter)
        r = self.client.delete(reverse('attachment-detail', args=[theirs]))
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_is_limited_to_thread_participants(self):
        inquiry = Inquiry.objects.get(pk=self.start().data['id'])
        attachment_id = self.upload(SimpleUploadedFile('notes.txt', b'hello')).data['id']
        self.send(inquiry, attachment_ids=[attachment_id])
        url = reverse('attachment-download', args=[attachment_id])

        for user in [self.adopter, self.owner]:
            self.as_user(user)
            r = self.client.get(url)
            self.assertEqual(r.status_code, status.HTTP_200_OK)
            self.assertEqual(b''.join(r.streaming_content), b'hello')
            self.assertEqual(r['Content-Type'], 'text/plain')

        self.as_user(self.stranger)
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(hasattr(r, 'streaming_content'))

    def test_upload_sweeps_own_staged_rows_older_than_24h_only(self):
        old = timezone.now() - timedelta(hours=25)
        stale = Attachment.objects.get(pk=self.upload(image_file()).data['id'])
        bound = Attachment.objects.get(pk=self.upload(image_file()).data['id'])
        recent = Attachment.objects.get(pk=self.upload(image_file()).data['id'])
        self.as_user(self.stranger)
        others = Attachment.objects.get(pk=self.upload(image_file()).data['id'])
        self.as_user(self.adopter)

        inquiry = Inquiry.objects.get(pk=self.start().data['id'])
        self.send(inquiry, attachment_ids=[str(bound.pk)])
        Attachment.objects.filter(pk__in=[stale.pk, bound.pk, others.pk]).update(created_at=old)

        self.upload(image_file())
        self.assertFalse(Attachment.objects.filter(pk=stale.pk).exists())
        self.assertFalse(default_storage.exists(stale.file.name))
        for kept in [bound, recent, others]:
            self.assertTrue(Attachment.objects.filter(pk=kept.pk).exists())


class MessageTests(InquiryTestCase):

    def setUp(self):
        super().setUp()
        self.inquiry = Inquiry.objects.get(pk=self.start().data['id'])

    def test_text_only_message(self):
        receivers = [listen(f'user.{self.owner.pk}'), listen(f'user.{self.adopter.pk}')]
        r = self.send(self.inquiry, body='Hello!')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['attachments'], [])
        for receive in receivers:
            self.assertEqual(receive(), {'type': 'chat.message', 'message': r.data})
        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.last_message_at, Message.objects.get().created_at)
        self.assertEqual(self.owner.notifications.filter(title='New message').count(), 1)

    def test_attachments_only_message_binds_them(self):
        attachment_id = self.upload(image_file()).data['id']
        r = self.send(self.inquiry, attachment_ids=[attachment_id])
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['body'], '')
        self.assertEqual([a['id'] for a in r.data['attachments']], [attachment_id])

    def test_empty_message_is_rejected(self):
        for data in [{}, {'body': '   '}, {'body': '', 'attachment_ids': []}]:
            r = self.send(self.inquiry, **data)
            self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('body', r.data['fields'])
        self.assertFalse(Message.objects.exists())

    def test_foreign_or_already_sent_attachment_is_rejected(self):
        self.as_user(self.stranger)
        foreign = self.upload(image_file()).data['id']
        self.as_user(self.adopter)
        sent = self.upload(image_file()).data['id']
        self.send(self.inquiry, attachment_ids=[sent])

        for attachment_id in [foreign, sent]:
            r = self.send(self.inquiry, body='Again', attachment_ids=[attachment_id])
            self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('attachment_ids', r.data['fields'])

    def test_message_over_the_length_limit_is_rejected(self):
        r = self.send(self.inquiry, body='x' * (MAX_MESSAGE_LENGTH + 1))
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('body', r.data['fields'])
        self.assertEqual(self.send(self.inquiry, body='x' * MAX_MESSAGE_LENGTH).status_code, status.HTTP_201_CREATED)

    def test_owner_reply_notifies_the_adopter(self):
        self.as_user(self.owner)
        self.send(self.inquiry, body='Hi there')
        self.assertEqual(self.adopter.notifications.filter(title='New message').count(), 1)

    def test_non_participant_cannot_read_or_write(self):
        self.as_user(self.stranger)
        url = reverse('inquiry-messages', args=[self.inquiry.pk])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.send(self.inquiry, body='Hi').status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(Message.objects.exists())

    def test_history_is_newest_page_first_with_before(self):
        for n in range(31):
            self.send(self.inquiry, body=f'Message {n}')
        url = reverse('inquiry-messages', args=[self.inquiry.pk])

        page = self.client.get(url).data
        self.assertEqual(len(page), 30)
        self.assertEqual(page[0]['body'], 'Message 30')

        older = self.client.get(url, {'before': page[-1]['id']}).data
        self.assertEqual([m['body'] for m in older], ['Message 0'])


class StageTests(InquiryTestCase):

    def setUp(self):
        super().setUp()
        self.inquiry = Inquiry.objects.get(pk=self.start().data['id'])
        self.as_user(self.owner)

    def change(self, stage):
        return self.client.patch(reverse('inquiry-stage', args=[self.inquiry.pk]), {'stage': stage}, format='json')

    def test_owner_moves_freely_between_stages_and_out_of_denied(self):
        for stage in ['visit', 'denied', 'decision', 'conversation']:
            r = self.change(stage)
            self.assertEqual(r.status_code, status.HTTP_200_OK)
            self.assertEqual(r.data['stage'], stage)
        self.assertFalse(Message.objects.exists())
        for party in [self.owner, self.adopter]:
            notifications = party.notifications.filter(title='Adoption stage changed')
            self.assertEqual(notifications.count(), 4)
            self.assertEqual(notifications.latest('created_at').body, "User 2's adoption of Karo moved to Conversation.")

    def test_stage_change_reaches_both_users(self):
        receivers = [listen(f'user.{self.owner.pk}'), listen(f'user.{self.adopter.pk}')]
        self.change('visit')
        expected = {'type': 'inquiry.stage_changed', 'inquiry_id': str(self.inquiry.pk), 'stage': 'visit'}
        for receive in receivers:
            self.assertIn(expected, [receive(), receive()])

    def test_non_owner_gets_403(self):
        for user in [self.adopter, self.stranger]:
            self.as_user(user)
            self.assertEqual(self.change('visit').status_code, status.HTTP_403_FORBIDDEN)
        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.stage, 'conversation')

    def test_unknown_stage_rejected(self):
        r = self.change('adopted')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('stage', r.data['fields'])

    def test_stage_changes_on_an_adopted_pet_are_rejected(self):
        self.client.post(reverse('pet-adopt', args=[self.pet.pk]), {'inquiry_id': self.inquiry.pk}, format='json')
        self.assertEqual(self.change('visit').status_code, status.HTTP_403_FORBIDDEN)


class AdoptTests(InquiryTestCase):

    def setUp(self):
        super().setUp()
        self.inquiry = Inquiry.objects.get(pk=self.start().data['id'])
        self.other = make_user('other', 4)
        self.as_user(self.other)
        self.other_inquiry = Inquiry.objects.get(pk=self.start().data['id'])
        self.as_user(self.owner)

    def adopt(self, inquiry_id):
        return self.client.post(reverse('pet-adopt', args=[self.pet.pk]), {'inquiry_id': inquiry_id}, format='json')

    def test_adopt_records_the_inquiry_adopter(self):
        receivers = [listen(f'pet.{self.pet.pk}'), listen('browse')]
        r = self.adopt(self.inquiry.pk)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['adopted_by']['handle'], 'adopter')
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.adopted_by, self.adopter)
        self.assertIsNotNone(self.pet.adopted_at)
        expected = {'type': 'pet.adopted', 'pet_id': str(self.pet.pk), 'adopted_by_id': str(self.adopter.pk)}
        for receive in receivers:
            self.assertEqual(receive(), expected)
        for party in [self.owner, self.adopter]:
            self.assertEqual(party.notifications.get(title='Adoption completed').body, 'Karo was adopted by User 2.')

    def test_adoption_disables_start_adoption_and_further_adoptions(self):
        self.adopt(self.inquiry.pk)
        self.assertEqual(self.adopt(self.other_inquiry.pk).status_code, status.HTTP_403_FORBIDDEN)
        self.as_user(self.stranger)
        self.assertEqual(self.start().status_code, status.HTTP_403_FORBIDDEN)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.adopted_by, self.adopter)

    def test_adoption_closes_every_thread_of_the_pet(self):
        self.adopt(self.inquiry.pk)
        self.assertEqual(self.send(self.other_inquiry, body='Still free?').status_code, status.HTTP_403_FORBIDDEN)
        self.as_user(self.adopter)
        self.assertEqual(self.send(self.inquiry, body='Thanks!').status_code, status.HTTP_403_FORBIDDEN)
        self.as_user(self.other)
        self.assertEqual(self.send(self.other_inquiry, body='Still free?').status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Message.objects.exists())

    def test_every_other_inquirer_is_told_it_went_to_someone_else(self):
        self.adopt(self.inquiry.pk)
        notification = self.other.notifications.get(title='Adopted by someone else')
        self.assertEqual(notification.body, 'Karo was adopted by someone else.')
        self.assertFalse(self.adopter.notifications.filter(title='Adopted by someone else').exists())
        self.other_inquiry.refresh_from_db()
        self.assertEqual(self.other_inquiry.stage, 'conversation')

    def test_non_owner_cannot_adopt(self):
        self.as_user(self.adopter)
        self.assertEqual(self.adopt(self.inquiry.pk).status_code, status.HTTP_403_FORBIDDEN)
        self.pet.refresh_from_db()
        self.assertIsNone(self.pet.adopted_by)

    def test_inquiry_of_another_pet_rejected(self):
        foreign = Inquiry.objects.create(pet=make_pet(self.owner, name='Kobi'), adopter=self.stranger)
        r = self.adopt(foreign.pk)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inquiry_id', r.data['fields'])


class RemoveListingTests(InquiryTestCase):

    def setUp(self):
        super().setUp()
        self.pet.photo.save('karo.png', image_file())
        self.inquiry = Inquiry.objects.get(pk=self.start().data['id'])
        self.attachment = Attachment.objects.get(pk=self.upload(image_file()).data['id'])
        self.send(self.inquiry, body='Hello', attachment_ids=[str(self.attachment.pk)])
        self.as_user(self.owner)

    def remove(self):
        return self.client.delete(reverse('pet-detail', args=[self.pet.pk]))

    def test_delete_notifies_adopters_then_removes_rows_and_files(self):
        receive = listen(f'pet.{self.pet.pk}')
        with self.captureOnCommitCallbacks(execute=True):
            r = self.remove()
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        for model in [Pet, Inquiry, Message, Attachment]:
            self.assertFalse(model.objects.exists())
        self.assertFalse(default_storage.exists(self.pet.photo.name))
        self.assertFalse(default_storage.exists(self.attachment.file.name))
        self.assertEqual(self.adopter.notifications.filter(title='Listing removed').count(), 1)
        self.assertEqual(receive(), {'type': 'pet.removed', 'pet_id': str(self.pet.pk)})

    def test_files_are_kept_when_the_delete_is_rolled_back(self):
        photo_name = self.pet.photo.name
        with self.captureOnCommitCallbacks(execute=True), self.assertRaises(RuntimeError), transaction.atomic():
            delete_pet(self.pet, self.owner)
            raise RuntimeError('rolled back')
        self.assertTrue(Pet.objects.exists())
        self.assertTrue(default_storage.exists(photo_name))
        self.assertTrue(default_storage.exists(self.attachment.file.name))

    def test_removal_notification_stands_alone_after_the_pet_is_gone(self):
        self.remove()
        self.as_user(self.adopter)
        notification = self.client.get(reverse('notification-list')).data['results'][0]
        self.assertEqual(notification['title'], 'Listing removed')
        self.assertEqual(notification['body'], 'User 1 removed the listing for Karo, so your adoption conversation was closed.')
        self.assertIsNone(notification['subject_id'])

    def test_adopted_listing_can_still_be_removed(self):
        self.client.post(reverse('pet-adopt', args=[self.pet.pk]), {'inquiry_id': self.inquiry.pk}, format='json')
        self.assertEqual(self.remove().status_code, status.HTTP_204_NO_CONTENT)

    def test_non_owner_cannot_remove(self):
        self.as_user(self.adopter)
        self.assertEqual(self.remove().status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Pet.objects.exists())
