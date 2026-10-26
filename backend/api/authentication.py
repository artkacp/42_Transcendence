from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .keys import check_key
from .models import APIKey


class APIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        full_key = request.headers.get('X-API-Key')
        if full_key is None:
            return None

        prefix, dot, secret = full_key.partition('.')
        if not (prefix and dot and secret):
            raise AuthenticationFailed('Malformed API key.')

        # Unknown prefix and wrong secret get the same message, so callers can't probe for prefixes.
        api_key = APIKey.objects.select_related('owner').filter(prefix=prefix).first()
        if api_key is None or not check_key(full_key, api_key.key_hash):
            raise AuthenticationFailed('Invalid API key.')
        # Checked only after the hash matches, so only the key's holder learns why it stopped working.
        if api_key.revoked:
            raise AuthenticationFailed('API key revoked.')
        if not api_key.owner.is_active:
            raise AuthenticationFailed('User is inactive.')

        APIKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())
        return (api_key.owner, api_key)

    # Any value here makes DRF answer a missing or bad key with 401 (instead of 403) and send it as WWW-Authenticate.
    def authenticate_header(self, request):
        return 'X-API-Key'
