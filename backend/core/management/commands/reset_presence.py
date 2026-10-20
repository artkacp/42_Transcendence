from django.core.management.base import BaseCommand

from accounts.models import User


# Presence lives in the backend process's RAM, so after a restart nobody is connected.
# Run by entrypoint.sh after migrate, before Daphne starts (never from AppConfig.ready()).
class Command(BaseCommand):
    help = 'Mark every user offline.'

    def handle(self, *args, **options):
        count = User.objects.filter(is_online=True).update(is_online=False)
        self.stdout.write(f'Presence reset: {count} users marked offline.')
