from django.urls import path

from .views import PetOptionsView

urlpatterns = [
    path('pet-options/', PetOptionsView.as_view(), name='pet-options'),
]
