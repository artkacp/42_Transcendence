from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from accounts.models import User
from api.serializers import APIKeyCreateSerializer
from notifications.services import notify


# Same serializer and notification as POST /api/keys/, so no sign-in or JWT is needed.
# Usage: docker compose exec backend python manage.py create_api_key <handle_or_email> --label <label>
class Command(BaseCommand):
    help = 'Create an API key for a user and print it once.'

    def add_arguments(self, parser):
        parser.add_argument('user', help='Handle or email of the key owner.')
        parser.add_argument('--label', required=True, help='Name shown in the key list.')

    def handle(self, *args, **options):
        identifier = options['user']
        # Handles are slugs, so they never contain "@" and can't match another user's email.
        user = User.objects.filter(Q(email__iexact=identifier) | Q(handle=identifier)).first()
        if user is None:
            raise CommandError(f'No user with handle or email "{identifier}".')
        # APIKeyAuthentication rejects keys of inactive users, so the key would never work.
        if not user.is_active:
            raise CommandError(f'User "{identifier}" is inactive.')

        serializer = APIKeyCreateSerializer(data={'label': options['label']})
        if not serializer.is_valid():
            raise CommandError(f'Invalid label: {serializer.errors["label"][0]}')
        api_key = serializer.save(owner=user)
        notify(user, 'create', 'API key created', f'Your API key "{api_key.label}" was created.', subject=api_key)

        self.stdout.write(f'API key "{api_key.label}" created for {user.email}.')
        self.stdout.write(f'Prefix: {api_key.prefix}')
        self.stdout.write(f'Key:    {api_key.key}')
        self.stdout.write('Copy the key now: only its hash is stored, so it cannot be shown again.')
