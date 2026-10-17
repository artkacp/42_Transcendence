from django.apps import AppConfig
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from sqlalchemy import inspect as sa_inspect

from analytics import handlers, signals
from analytics.db.models import Event


class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analytics'

    def ready(self):
        self._connect_signals()
        self._check_mapping()

    def _connect_signals(self):
        signals.pet_viewed.connect(handlers.handle_pet_viewed)
        signals.inquiry_opened.connect(handlers.handle_inquiry_opened)
        signals.message_sent.connect(handlers.handle_message_sent)
        signals.adoption_completed.connect(handlers.handle_adoption_completed)
        signals.listing_published.connect(handlers.handle_listing_published)
        signals.user_registered.connect(handlers.handle_user_registered)

    def _check_mapping(self):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'analytics_event'
            """)
            db_columns = {row[0] for row in cursor.fetchall()}

        if not db_columns:
            return  # table not yet created — migration will handle it

        mapper = sa_inspect(Event)
        mapped_columns = {attr.columns[0].name for attr in mapper.column_attrs}

        missing = mapped_columns - db_columns
        if missing:
            raise ImproperlyConfigured(
                f"analytics_event schema mismatch — mapped columns absent from DB: {missing}. "
                "Update the RunSQL migration."
            )
