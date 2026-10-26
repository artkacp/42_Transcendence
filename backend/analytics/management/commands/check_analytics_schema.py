from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from sqlalchemy import inspect as sa_inspect

from analytics.db.models import Event


# Run by entrypoint.sh after migrate, before Daphne starts (never from AppConfig.ready()).
class Command(BaseCommand):
    help = 'Verify SQLAlchemy mapping matches the analytics_event table in the DB.'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'analytics_event'
            """)
            db_columns = {row[0] for row in cursor.fetchall()}

        if not db_columns:
            self.stdout.write('analytics_event table not found — skipping mapping check.')
            return

        mapper = sa_inspect(Event)
        mapped_columns = {attr.columns[0].name for attr in mapper.column_attrs}

        missing = mapped_columns - db_columns
        if missing:
            raise CommandError(
                f"analytics_event schema mismatch — mapped columns absent from DB: {missing}. "
                "Update the RunSQL migration."
            )

        self.stdout.write('analytics_event mapping OK.')
