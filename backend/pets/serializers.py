from rest_framework import serializers

from accounts.serializers import UserMinimalSerializer
from core.validators import allowed_content_type, max_file_size

from .models import (
    AGE_BUCKETS,
    BREEDS,
    CITIES,
    MAX_STORY_LENGTH,
    ORDERINGS,
    SEX_CHOICES,
    SIZE_CHOICES,
    SPECIES_CHOICES,
    TRAITS,
    Pet,
)

ALL_BREEDS = [breed for breeds in BREEDS.values() for breed in breeds]


class TraitsField(serializers.ListField):
    # Multipart has no empty list: a single blank value means "no traits"
    def to_internal_value(self, data):
        return super().to_internal_value([trait for trait in data if trait != ''])


class PetSerializer(serializers.ModelSerializer):
    owner = UserMinimalSerializer(read_only=True)
    adopted_by = UserMinimalSerializer(read_only=True)
    inquiry_count = serializers.IntegerField(read_only=True, default=0)
    breed = serializers.ChoiceField(choices=ALL_BREEDS)
    city = serializers.ChoiceField(choices=CITIES)
    traits = TraitsField(child=serializers.ChoiceField(choices=TRAITS), max_length=4, required=False)
    photo = serializers.ImageField(
        required=False, allow_null=True, validators=[max_file_size(5), allowed_content_type('pet_photo')],
    )

    class Meta:
        model = Pet
        fields = [
            'id', 'owner', 'name', 'species', 'breed', 'age_years', 'size', 'sex', 'city', 'story',
            'traits', 'photo', 'is_vaccinated', 'is_neutered', 'adopted_by', 'adopted_at',
            'inquiry_count', 'created_at',
        ]
        read_only_fields = ['adopted_at']
        extra_kwargs = {
            'name': {'min_length': 2},
            'story': {'min_length': 20, 'max_length': MAX_STORY_LENGTH},
            'age_years': {'min_value': 0, 'max_value': 20},
        }

    def validate(self, attrs):
        # A PATCH may send only species or only breed: check the pair the pet will end up with
        pet = {'species': self.instance.species, 'breed': self.instance.breed, **attrs} if self.instance else attrs
        if pet['breed'] not in BREEDS[pet['species']]:
            raise serializers.ValidationError({'breed': 'Breed does not belong to the selected species.'})
        return attrs


class PetFilterSerializer(serializers.Serializer):
    q = serializers.CharField(required=False)
    species = serializers.ChoiceField(choices=SPECIES_CHOICES, required=False)
    sex = serializers.ChoiceField(choices=SEX_CHOICES, required=False)
    size = serializers.ChoiceField(choices=SIZE_CHOICES, required=False)
    age_bucket = serializers.ChoiceField(choices=list(AGE_BUCKETS), required=False)
    city = serializers.ChoiceField(choices=CITIES, required=False)
    breed = serializers.ChoiceField(choices=ALL_BREEDS, required=False)
    trait = serializers.ChoiceField(choices=TRAITS, required=False)
    vaccinated = serializers.BooleanField(required=False)
    neutered = serializers.BooleanField(required=False)
    ordering = serializers.ChoiceField(choices=ORDERINGS, required=False)
