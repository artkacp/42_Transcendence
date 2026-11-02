from django.conf import settings
from django.contrib.auth import password_validation
from django.db.models import Q
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer

from core.validators import allowed_content_type, max_file_size
from pets.models import CITIES

from .models import MAX_BIO_LENGTH, Friendship, User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'full_name']
        extra_kwargs = {
            'email': {
                'validators': [
                    UniqueValidator(
                        User.objects.all(),
                        message='An account with this email already exists.',
                        lookup='iexact',
                    ),
                ],
            },
        }

    def validate_password(self, value):
        user = User(
            email=self.initial_data.get('email'),
            full_name=self.initial_data.get('full_name'),
        )
        password_validation.validate_password(value, user)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        attrs['email'] = attrs['email'].lower()
        return super().validate(attrs)


class CookieTokenRefreshSerializer(TokenRefreshSerializer):
    refresh = None

    def validate(self, attrs):
        attrs['refresh'] = self.context['request'].COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not attrs['refresh']:
            raise InvalidToken('Refresh cookie missing.')
        return super().validate(attrs)


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


class MeSerializer(UserMinimalSerializer):
    unread_notifications = serializers.SerializerMethodField()

    class Meta(UserMinimalSerializer.Meta):
        fields = UserMinimalSerializer.Meta.fields + ['email', 'unread_notifications']

    def get_unread_notifications(self, obj):
        return obj.notifications.filter(is_read=False).count()


class UserProfileSerializer(UserMinimalSerializer):
    friendship = serializers.SerializerMethodField()

    class Meta(UserMinimalSerializer.Meta):
        fields = UserMinimalSerializer.Meta.fields + ['friendship']

    def get_friendship(self, obj):
        me = self.context['request'].user
        friendship = Friendship.objects.filter(
            Q(requester=me, addressee=obj) | Q(requester=obj, addressee=me)
        ).first()
        if friendship is None:
            return None
        return {
            'id': friendship.id,
            'status': friendship.status,
            'requested_by_me': friendship.requester_id == me.pk,
        }


class UserUpdateSerializer(serializers.ModelSerializer):
    city = serializers.ChoiceField(choices=CITIES, allow_null=True, required=False)

    class Meta:
        model = User
        fields = ['full_name', 'city', 'bio']
        extra_kwargs = {'full_name': {'min_length': 2}, 'bio': {'max_length': MAX_BIO_LENGTH}}


class AvatarSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(validators=[max_file_size(2), allowed_content_type('avatar')])

    class Meta:
        model = User
        fields = ['avatar']


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
