from rest_framework import serializers

from .models import Pet


class PetCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pet
        fields = [
            'id', 'name', 'species', 'breed', 'age_years', 'size', 'sex', 'city',
            'traits', 'photo', 'is_vaccinated', 'is_neutered', 'created_at',
        ]
