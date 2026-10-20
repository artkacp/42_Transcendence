import uuid

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from rest_framework.test import APIClient

from analytics.db.engine import Session, engine
from analytics.db.models import Event
from django.test import TransactionTestCase

User = get_user_model()

URL = '/api/analytics/me/'


class UserAnalyticsAPITestCase(TransactionTestCase):
    """
    Uses TransactionTestCase so that Django's test wrapper does not hold an open
    transaction that SQLAlchemy's separate connection cannot see.  Same pattern as
    the A2 signal tests.
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
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='seeker@example.com',
            full_name='Seeker User',
            handle='seeker',
            password='pass',
        )
        self.owner = User.objects.create_user(
            email='owner@example.com',
            full_name='Owner User',
            handle='owner',
            password='pass',
        )

    def tearDown(self):
        with connection.cursor() as c:
            c.execute('DELETE FROM analytics_event')

    def _insert_event(self, user_id, event_type, metadata=None):
        session = Session()
        try:
            session.add(Event(
                id=uuid.uuid4(),
                user_id=user_id,
                pet_id=None,
                event_type=event_type,
                event_metadata=metadata or {},
            ))
            session.commit()
        finally:
            session.close()

    def test_unauthenticated_returns_401(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 401)

    def test_authenticated_returns_correct_shape(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('as_seeker', data)
        self.assertIn('as_rehomer', data)
        seeker_keys = {'pets_viewed', 'applications_sent', 'adoptions_completed'}
        rehomer_keys = {'listings_published', 'views_received', 'inquiries_received', 'pets_adopted_out'}
        self.assertEqual(set(data['as_seeker'].keys()), seeker_keys)
        self.assertEqual(set(data['as_rehomer'].keys()), rehomer_keys)

    def test_zero_counts_when_no_events(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(URL)
        data = response.json()
        for val in data['as_seeker'].values():
            self.assertEqual(val, 0)
        for val in data['as_rehomer'].values():
            self.assertEqual(val, 0)

    def test_seeker_counts_match_user_events(self):
        uid = self.user.id
        self._insert_event(uid, 'visit')
        self._insert_event(uid, 'visit')
        self._insert_event(uid, 'application')
        self._insert_event(uid, 'adoption')

        self.client.force_authenticate(user=self.user)
        data = self.client.get(URL).json()
        self.assertEqual(data['as_seeker']['pets_viewed'], 2)
        self.assertEqual(data['as_seeker']['applications_sent'], 1)
        self.assertEqual(data['as_seeker']['adoptions_completed'], 1)

    def test_rehomer_counts_match_owner_id_in_metadata(self):
        owner_meta = {'owner_id': str(self.owner.id)}
        other_uid = self.user.id

        self._insert_event(other_uid, 'visit', owner_meta)
        self._insert_event(other_uid, 'visit', owner_meta)
        self._insert_event(other_uid, 'application', owner_meta)
        self._insert_event(other_uid, 'adoption', owner_meta)
        self._insert_event(other_uid, 'listing_published', {'owner_id': str(self.owner.id)})
        # listing_published for owner counts as actor, not metadata
        self._insert_event(self.owner.id, 'listing_published')

        self.client.force_authenticate(user=self.owner)
        data = self.client.get(URL).json()
        self.assertEqual(data['as_rehomer']['views_received'], 2)
        self.assertEqual(data['as_rehomer']['inquiries_received'], 1)
        self.assertEqual(data['as_rehomer']['pets_adopted_out'], 1)
        self.assertEqual(data['as_rehomer']['listings_published'], 1)

    def test_counts_are_user_scoped(self):
        """Events from another user do not appear in the requesting user's counts."""
        other_uid = self.owner.id
        self._insert_event(other_uid, 'visit')
        self._insert_event(other_uid, 'application')

        self.client.force_authenticate(user=self.user)
        data = self.client.get(URL).json()
        self.assertEqual(data['as_seeker']['pets_viewed'], 0)
        self.assertEqual(data['as_seeker']['applications_sent'], 0)
