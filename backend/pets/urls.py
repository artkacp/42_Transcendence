from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PetOptionsView, PetViewSet

router = DefaultRouter()
router.register(r'pets', PetViewSet, basename='pet')

urlpatterns = [
    path('pet-options/', PetOptionsView.as_view(), name='pet-options'),
    path('', include(router.urls)),
]
