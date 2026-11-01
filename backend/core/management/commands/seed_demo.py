import os
import random
import secrets
import uuid
from datetime import timedelta
from pathlib import Path

from django.core.files import File
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Friendship, User
from accounts.views import notify_both_friends
from analytics import handlers, signals
from analytics.db.engine import Session
from analytics.db.models import Event
from inquiries.models import STAGE_CHOICES, Attachment, Inquiry, Message
from inquiries.services import change_stage, complete_adoption, send_message, start_inquiry
from notifications.models import Notification
from notifications.services import notify
from pets.models import BREEDS, CITIES, SEX_CHOICES, SIZE_CHOICES, TRAITS, Pet
from pets.services import create_pet, delete_pet

SEED_IMAGES = Path(__file__).resolve().parents[2] / 'seed_images'
RANDOM_SEED = 42
ADOPTIONS = 5

PEOPLE = [
    ('Sara Hernandez', 'Dog person, cat curious.'),
    ('Maya Torres', 'Foster mom to more cats than she admits.'),
    ('Leo Nowak', 'Dog trainer and weekend foster.'),
    ('Ania Kowalska', 'Vet nurse who always has room for one more.'),
    ('Tomek Zielinski', 'Runner looking for a four-legged pace setter.'),
    ('Sofia Marin', 'Works from home, the sofa is free.'),
    ('Jan Wisniewski', 'Retired teacher with a big garden.'),
    ('Nina Lewandowska', 'Rehoming pets for elderly neighbours.'),
    ('Piotr Dabrowski', 'First-time adopter, reading everything.'),
    ('Ola Wojcik', 'Shelter volunteer on Saturdays.'),
    ('Adam Kaminski', 'Family of four, two kids, one empty basket.'),
]
# One pet per photo in seed_images/<species>/
PET_NAMES = {
    'cat': ['Miso', 'Pumpkin', 'Luna', 'Nala', 'Mochi', 'Bella', 'Figa', 'Zuzia', 'Olive', 'Pepper'],
    'dog': ['Cookie', 'Bruno', 'Rex', 'Kobi', 'Tofik', 'Bazyl', 'Hugo', 'Azor', 'Burek', 'Maks'],
}
ADOPTER_LINES = [
    'Hi! Is the pet still looking for a home?',
    'We have a quiet flat and a lot of free time. Could we meet?',
    'Are there any health issues I should know about?',
    'That sounds lovely, thank you for the details.',
]
OWNER_LINES = [
    'Hello! Yes, still looking. Tell me a bit about your home.',
    'Of course, a visit this weekend would work well.',
    'Vaccinations are up to date, I can share the booklet.',
    'Thanks for writing, I will get back to you soon.',
]


def seed_email(name):
    return f'{name.split()[0].lower()}@example.com'


SEED_EMAILS = [seed_email(name) for name, _ in PEOPLE]


def photo_file(path):
    return SimpleUploadedFile(path.name, path.read_bytes(), content_type='image/jpeg')


def values(choices):
    return [value for value, _ in choices]


class Command(BaseCommand):
    help = 'Create demo users, pets, conversations and 30 days of analytics. Touches only seed accounts.'

    def add_arguments(self, parser):
        parser.add_argument('--flush', action='store_true', help='Delete the seed data first, then re-seed.')

    def handle(self, *args, **options):
        seeded = User.objects.filter(email__in=SEED_EMAILS)
        if seeded.exists() and not options['flush']:
            self.stdout.write('Seed data already exists; nothing to do. Use --flush to recreate it.')
            return

        # Never hard-coded: this repository is public
        configured = os.environ.get('SEED_DEMO_PASSWORD')
        self.password = configured or secrets.token_urlsafe(12)
        self.rng = random.Random(RANDOM_SEED)
        self.now = timezone.now()
        self.events = []

        # The services would stamp every event with now(); we write them ourselves, backdated
        receivers = [
            (signals.pet_viewed, handlers.handle_pet_viewed),
            (signals.inquiry_opened, handlers.handle_inquiry_opened),
            (signals.message_sent, handlers.handle_message_sent),
            (signals.adoption_completed, handlers.handle_adoption_completed),
            (signals.listing_published, handlers.handle_listing_published),
            (signals.user_registered, handlers.handle_user_registered),
        ]
        for signal, receiver in receivers:
            signal.disconnect(receiver)
        try:
            self.flush(seeded)
            with transaction.atomic():
                users = self.create_users()
                pets = self.create_pets(users)
                self.create_conversations(pets, users)
                self.create_friendships(users)
        finally:
            for signal, receiver in receivers:
                signal.connect(receiver)
        self.write_events()

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(users)} users, {len(pets)} pets and {len(self.events)} analytics events.'
        ))
        if configured:
            self.stdout.write(f'Sign in as {SEED_EMAILS[0]} (or any seed address) with SEED_DEMO_PASSWORD.')
        else:
            self.stdout.write(f'Sign in as {SEED_EMAILS[0]} (or any seed address) with password: {self.password}')

    def flush(self, seeded):
        # analytics_event.user_id has no FK, so deleting a user would leave these rows behind
        user_ids = list(seeded.values_list('id', flat=True))
        if not user_ids:
            return
        session = Session()
        try:
            session.query(Event).filter(Event.user_id.in_(user_ids)).delete(synchronize_session=False)
            session.commit()
        finally:
            session.close()

        for pet in Pet.objects.filter(owner__in=user_ids).select_related('owner'):
            delete_pet(pet, pet.owner)
        for attachment in Attachment.objects.filter(uploaded_by__in=user_ids):
            attachment.file.delete(save=False)
        for user in seeded.exclude(avatar=''):
            user.avatar.delete(save=False)
        seeded.delete()

    def days_ago(self, days):
        return self.now - timedelta(days=days)

    def between(self, start, end):
        return start + (end - start) * self.rng.random()

    def event(self, user, event_type, when, pet=None):
        metadata = handlers._pet_metadata(pet) if pet else {}
        self.events.append(Event(
            id=uuid.uuid4(),
            user_id=user.pk,
            pet_id=pet.pk if pet else None,
            event_type=event_type,
            occurred_at=when,
            event_metadata=metadata,
        ))

    # Rows the services just created still carry now(); everything older is already backdated
    def backdate_notifications(self, when):
        Notification.objects.filter(
            recipient__email__in=SEED_EMAILS, created_at__gte=self.now,
        ).update(created_at=when)

    def create_users(self):
        users = []
        for index, (name, bio) in enumerate(PEOPLE):
            email = seed_email(name)
            user = User.objects.create_user(
                email=email,
                full_name=name,
                password=self.password,
                city=self.rng.choice(CITIES),
                bio=bio,
            )
            with (SEED_IMAGES / 'avatars' / f'avatar-{index + 1:02}.jpg').open('rb') as image:
                user.avatar.save('avatar.jpg', File(image))
            joined = self.days_ago(29 - index * 2.2)
            User.objects.filter(pk=user.pk).update(date_joined=joined)
            user.date_joined = joined
            self.event(user, 'registered', joined)
            users.append(user)
        return users

    def create_pets(self, users):
        photos = [
            (species, name, path)
            for species, names in PET_NAMES.items()
            for name, path in zip(names, sorted((SEED_IMAGES / species).glob('*.jpg')))
        ]
        self.rng.shuffle(photos)
        count = len(photos)
        ages = [round(index * 20 / (count - 1)) for index in range(count)]
        self.rng.shuffle(ages)
        pets = []
        for index, (kind, name, path) in enumerate(photos):
            traits = self.rng.sample(TRAITS, self.rng.randint(1, 4))
            breed = self.rng.choice(BREEDS[kind])
            owner = self.rng.choice(users[:6])
            pet = create_pet(owner, {
                'name': name,
                'species': kind,
                'breed': breed,
                'age_years': ages[index],
                'size': self.rng.choice(values(SIZE_CHOICES)),
                'sex': self.rng.choice(values(SEX_CHOICES)),
                'city': self.rng.choice(CITIES),
                'story': f'{name} is a {traits[0]} {breed.lower()} looking for a patient, loving home.',
                'traits': traits,
                'is_vaccinated': self.rng.random() < 0.7,
                'is_neutered': self.rng.random() < 0.5,
                'photo': photo_file(path),
            })
            # Spread evenly so the charts have activity across the whole window
            published = max(owner.date_joined, self.days_ago(28 - index * 25 / count))
            Pet.objects.filter(pk=pet.pk).update(created_at=published)
            pet.created_at = published
            self.backdate_notifications(published)
            self.event(owner, 'listing_published', published, pet)
            pets.append(pet)
        return pets

    def create_conversations(self, pets, users):
        by_age = sorted(pets, key=lambda pet: pet.created_at)
        adopted = {pet.pk for pet in by_age[:ADOPTIONS]}
        for pet in pets:
            others = [user for user in users if user != pet.owner]
            self.create_visits(pet, others)
            threads = [self.create_thread(pet, adopter) for adopter in self.rng.sample(others, self.rng.randint(2, 4))]
            if pet.pk in adopted:
                self.adopt(pet, threads)

    def create_visits(self, pet, visitors):
        # A few early visits, so the first days of a listing are not empty
        early = [user for user in visitors if user.date_joined <= pet.created_at] or visitors
        for visitor in self.rng.sample(early, min(3, len(early))):
            start = max(pet.created_at, visitor.date_joined)
            self.event(visitor, 'visit', self.between(start, start + timedelta(days=2)), pet)
        for _ in range(self.rng.randint(6, 13)):
            visitor = self.rng.choice(visitors)
            self.event(visitor, 'visit', self.between(max(pet.created_at, visitor.date_joined), self.now), pet)

    def create_thread(self, pet, adopter):
        opened = self.between(max(pet.created_at, adopter.date_joined), self.days_ago(2))
        inquiry, _ = start_inquiry(pet, adopter)
        Inquiry.objects.filter(pk=inquiry.pk).update(created_at=opened)
        self.backdate_notifications(opened)
        self.event(adopter, 'application', opened, pet)

        sent = opened
        for turn in range(self.rng.randint(2, 8)):
            sender, lines = (adopter, ADOPTER_LINES) if turn % 2 == 0 else (pet.owner, OWNER_LINES)
            sent += timedelta(minutes=self.rng.randint(20, 240))
            message = send_message(sender, inquiry.pk, lines[turn // 2 % len(lines)], [])
            Message.objects.filter(pk=message.pk).update(created_at=sent)
            self.backdate_notifications(sent)
            self.event(sender, 'message', sent, pet)
        Inquiry.objects.filter(pk=inquiry.pk).update(last_message_at=sent)

        stage = self.rng.choice(values(STAGE_CHOICES))
        if stage != inquiry.stage:
            inquiry = change_stage(pet.owner, inquiry.pk, stage)
            self.backdate_notifications(sent)
        return inquiry, sent

    def adopt(self, pet, threads):
        candidates = [thread for thread in threads if thread[0].stage != 'denied'] or threads
        inquiry, _ = self.rng.choice(candidates)
        adopted_at = max(sent for _, sent in threads) + timedelta(hours=6)
        complete_adoption(pet, pet.owner, inquiry.pk)
        Pet.objects.filter(pk=pet.pk).update(adopted_at=adopted_at)
        self.backdate_notifications(adopted_at)
        self.event(inquiry.adopter, 'adoption', adopted_at, pet)

    def create_friendships(self, users):
        for requester, addressee in zip(users[:4], users[1:5]):
            friendship = Friendship.objects.create(
                requester=requester, addressee=addressee, status=Friendship.STATUS_ACCEPTED,
            )
            notify_both_friends(friendship, 'create', 'Friend added', 'You and {name} are now friends.')
        requester, addressee = users[5], users[0]
        Friendship.objects.create(requester=requester, addressee=addressee)
        notify(addressee, 'create', 'Friend request', f'{requester.full_name} sent you a friend request.', subject=requester)
        self.backdate_notifications(self.days_ago(1))

    def write_events(self):
        session = Session()
        try:
            session.add_all(self.events)
            session.commit()
        finally:
            session.close()
