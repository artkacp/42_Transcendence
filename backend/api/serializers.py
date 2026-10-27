from rest_framework import serializers

from pets.models import Pet

from .keys import generate_key
from .models import APIKey


class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['id', 'label', 'prefix', 'created_at', 'last_used_at', 'revoked', 'rate_per_minute']
        read_only_fields = fields


class APIKeyCreateSerializer(serializers.ModelSerializer):
    key = serializers.CharField(read_only=True)

    class Meta:
        model = APIKey
        fields = ['id', 'label', 'prefix', 'key', 'created_at']
        read_only_fields = ['id', 'prefix', 'created_at']

    def create(self, validated_data):
        full_key, prefix, key_hash = generate_key()
        api_key = APIKey.objects.create(prefix=prefix, key_hash=key_hash, **validated_data)
        # Not a model field: set only on this instance so the create response can show the key once.
        api_key.key = full_key
        return api_key


# What third parties see of a pet: nothing about the owner or adopter, and no app-only fields
# (inquiry_count, adopted_by, adopted_at), just whether the pet has been adopted.
class PublicPetSerializer(serializers.ModelSerializer):
    is_adopted = serializers.SerializerMethodField()

    class Meta:
        model = Pet
        fields = [
            'id', 'name', 'species', 'breed', 'age_years', 'size', 'sex', 'city', 'story', 'traits',
            'is_vaccinated', 'is_neutered', 'photo', 'created_at', 'is_adopted',
        ]
        read_only_fields = fields

    # The return annotation is the type the OpenAPI schema shows for this field.
    def get_is_adopted(self, pet) -> bool:
        return pet.adopted_by_id is not None
