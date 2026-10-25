from rest_framework import serializers

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
