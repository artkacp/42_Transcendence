from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .public import PublicOptionsView
from .views import APIKeyViewSet

router = DefaultRouter()
router.register(r'keys', APIKeyViewSet, basename='api-key')

urlpatterns = [
    path('', include(router.urls)),
]

# Mounted under api/public/v1/ in config/urls.py.
public_urlpatterns = [
    path('options/', PublicOptionsView.as_view(), name='public-options'),
]
