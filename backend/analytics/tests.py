import json

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TransactionTestCase

from analytics import signals
from analytics.db.engine import engine
from analytics.handlers import _write_event
from pets.models import Pet

User = get_user_model()


class AnalyticsEventTestCase(TransactionTestCase):
    """
    Uses TransactionTestCase so that on_commit callbacks fire and SQLAlchemy
    writes land in the DB.

    analytics_event has a FK to pets_pet. Django's default TRUNCATE (no CASCADE)
    is rejected by PostgreSQL when another table holds a FK reference to the one
    being truncated. We override only _fixture_teardown (the per-test teardown
    flush) to pass allow_cascade=True. That CASCADE also truncates analytics_event,
    leaving it empty for the next test's default _pre_setup flush (which succeeds
    when analytics_event has no rows).

    engine.dispose() in setUp forces the SQLAlchemy pool to open fresh connections
    so they see data committed by Django's setUp queries.
    """

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        super().tearDownClass()

    def _fixture_teardown(self):
        for db_name in self._databases_names(include_mirrors=False):
            call_command(
                'flush',
                verbosity=0,
                interactive=False,
                database=db_name,
                reset_sequences=self.reset_sequences,
                allow_cascade=True,
                inhibit_post_migrate=True,
            )

    def setUp(self):
        engine.dispose()
        self.user = User.objects.create_user(
            email='test@example.com',
            full_name='Test User',
            handle='testuser',
            password='testpass123',
        )
        self.pet = Pet.objects.create(
            owner=self.user,
            name='Buddy',
            species='dog',
            breed='Labrador',
            age_years=3,
            size='large',
            sex='male',
            city='Warsaw',
            story='A friendly and energetic dog who loves to play fetch all day.',
        )

    def tearDown(self):
        with connection.cursor() as c:
            c.execute('DELETE FROM analytics_event')

    def _fetch_events(self, user_id):
        with connection.cursor() as c:
            c.execute(
                'SELECT event_type, pet_id FROM analytics_event WHERE user_id = %s ORDER BY occurred_at',
                [str(user_id)],
            )
            return c.fetchall()

    def test_write_event_creates_row(self):
        _write_event(self.user.id, self.pet.id, 'visit', {'species': 'dog'})
        rows = self._fetch_events(self.user.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'visit')
        self.assertEqual(str(rows[0][1]), str(self.pet.id))

    def test_write_event_registered_has_no_pet(self):
        _write_event(self.user.id, None, 'registered', {})
        rows = self._fetch_events(self.user.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'registered')
        self.assertIsNone(rows[0][1])

    def test_pet_viewed_signal_writes_visit(self):
        signals.pet_viewed.send(sender=None, user=self.user, pet=self.pet)
        rows = self._fetch_events(self.user.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'visit')

    def test_listing_published_signal_writes_event(self):
        signals.listing_published.send(sender=None, user=self.user, pet=self.pet)
        rows = self._fetch_events(self.user.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'listing_published')

    def test_user_registered_signal_writes_event(self):
        signals.user_registered.send(sender=None, user=self.user)
        rows = self._fetch_events(self.user.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'registered')
        self.assertIsNone(rows[0][1])

    def test_inquiry_opened_signal_writes_application(self):
        signals.inquiry_opened.send(sender=None, user=self.user, pet=self.pet)
        rows = self._fetch_events(self.user.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'application')

    def test_metadata_snapshot_contains_pet_features(self):
        signals.pet_viewed.send(sender=None, user=self.user, pet=self.pet)
        with connection.cursor() as c:
            c.execute(
                'SELECT metadata FROM analytics_event WHERE user_id = %s',
                [str(self.user.id)],
            )
            raw = c.fetchone()[0]
        metadata = json.loads(raw) if isinstance(raw, str) else raw
        self.assertEqual(metadata['species'], 'dog')
        self.assertEqual(metadata['breed'], 'Labrador')
        self.assertEqual(metadata['age_years'], 3)
        self.assertEqual(metadata['size'], 'large')
        self.assertEqual(metadata['sex'], 'male')
        self.assertFalse(metadata['is_vaccinated'])
        self.assertFalse(metadata['is_neutered'])
        self.assertIsInstance(metadata['traits'], list)
