from django.urls import path

from .consumers import SocketConsumer

websocket_urlpatterns = [
    path('ws/', SocketConsumer.as_asgi()),
]
