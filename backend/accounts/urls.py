from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FriendshipViewSet

router = DefaultRouter()
router.register(r'friends', FriendshipViewSet, basename='friendship')

urlpatterns = [
    path('', include(router.urls)),
]
