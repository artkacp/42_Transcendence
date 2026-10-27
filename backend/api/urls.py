from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter, SimpleRouter

from .public import PublicOptionsView, PublicPetViewSet
from .views import APIKeyViewSet

router = DefaultRouter()
router.register(r'keys', APIKeyViewSet, basename='api-key')

urlpatterns = [
    path('', include(router.urls)),
]

# SimpleRouter: DefaultRouter would also add its JWT-protected API root view at /api/public/v1/.
public_router = SimpleRouter()
public_router.register(r'pets', PublicPetViewSet, basename='public-pet')

# Mounted under api/public/v1/ in config/urls.py.
public_urlpatterns = [
    path('options/', PublicOptionsView.as_view(), name='public-options'),
    # Open to anyone: no key, no throttle (SPECTACULAR_SETTINGS in config/settings.py).
    path('schema/', SpectacularAPIView.as_view(), name='public-schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='public-schema'), name='public-docs'),
    path('', include(public_router.urls)),
]
