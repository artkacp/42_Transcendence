import os
import tempfile
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests import auth, image_file, make_pet, make_user

from .models import Attachment, Inquiry, Message


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
        receive = listen(f'pet.{self.pet.pk}')
        r = self.send(self.inquiry, body='Hello!')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['attachments'], [])
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
