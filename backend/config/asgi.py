"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

# Imported once Django is set up: the consumer loads simplejwt and the user model.
from core.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    # No session/cookie auth: the consumer checks the JWT in the first frame.
    # The Origin check stops other websites from opening sockets to us.
    'websocket': AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
})
