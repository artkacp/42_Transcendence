from rest_framework import serializers

from .models import Friendship, User


class UserMinimalSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'handle', 'full_name', 'avatar', 'is_online', 'city', 'bio']

    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None


class FriendshipSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()

    class Meta:
        model = Friendship
        fields = ['id', 'status', 'created_at', 'other_user']

    def get_other_user(self, obj):
        request = self.context.get('request')
        me = request.user if request else None
        other = obj.addressee if obj.requester_id == getattr(me, 'pk', None) else obj.requester
        return UserMinimalSerializer(other, context=self.context).data


class FriendshipCreateSerializer(serializers.Serializer):
    addressee = serializers.UUIDField()

    def validate_addressee(self, value):
        request = self.context['request']
        if value == request.user.pk:
            raise serializers.ValidationError('You cannot add yourself as a friend.')
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError('User not found.')
        return value
