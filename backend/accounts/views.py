from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from analytics import signals as analytics_signals
from notifications.services import notify
from pets.serializers import PetSerializer

from .models import Friendship, User
from .serializers import (
    AvatarSerializer,
    CookieTokenRefreshSerializer,
    FriendshipCreateSerializer,
    FriendshipSerializer,
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
)


def set_refresh_cookie(response, refresh):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresh),
        max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'],
        path=settings.REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def notify_both_friends(friendship, kind, title, body):
    for user, friend in [
        (friendship.requester, friendship.addressee),
        (friendship.addressee, friendship.requester),
    ]:
        notify(user, kind, title, body.format(name=friend.full_name), subject=friend)


def accept_friendship(friendship):
    # The status check is part of the UPDATE, so when two accepts race only
    # one of them matches the row and sends the notifications
    updated = Friendship.objects.filter(
        pk=friendship.pk,
        status=Friendship.STATUS_PENDING,
    ).update(status=Friendship.STATUS_ACCEPTED)
    if not updated:
        raise ValidationError({'detail': 'This request is not pending.'})
    friendship.status = Friendship.STATUS_ACCEPTED
    notify_both_friends(friendship, 'create', 'Friend added', 'You and {name} are now friends.')


class RefreshCookieMixin:
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        set_refresh_cookie(response, response.data.pop('refresh'))
        return response


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        analytics_signals.user_registered.send(sender=self.__class__, user=user)
        refresh = RefreshToken.for_user(user)
        response = Response({'access': str(refresh.access_token)}, status=status.HTTP_201_CREATED)
        set_refresh_cookie(response, refresh)
        return response


class LoginView(RefreshCookieMixin, TokenObtainPairView):
    serializer_class = LoginSerializer


class RefreshView(RefreshCookieMixin, TokenRefreshView):
    serializer_class = CookieTokenRefreshSerializer


class LogoutView(APIView):
    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path=settings.REFRESH_COOKIE_PATH,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
        return response


class MeView(generics.RetrieveAPIView):
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


class UserViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer

    # GET /users/{id}/pets/
    @action(detail=True, methods=['get'])
    def pets(self, request, pk=None):
        pets = self.get_object().pets.filter(adopted_by=None).order_by('-created_at')
        return Response(PetSerializer(pets, many=True, context={'request': request}).data)

    # PATCH /users/me/
    @action(detail=False, methods=['patch'])
    def me(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        notify(request.user, 'update', 'Profile updated', 'Your profile changes were saved.')
        return Response(MeSerializer(request.user, context={'request': request}).data)

    # PUT / DELETE /users/me/avatar/
    @action(detail=False, methods=['put', 'delete'], url_path='me/avatar')
    def avatar(self, request):
        user = request.user
        if request.method == 'PUT':
            serializer = AvatarSerializer(user, data=request.data)
            serializer.is_valid(raise_exception=True)
            user.avatar.delete(save=False)
            serializer.save()
            notify(user, 'update', 'Profile updated', 'Your avatar was updated.')
        else:
            user.avatar.delete()
            notify(user, 'update', 'Profile updated', 'Your avatar was removed.')
        return Response(MeSerializer(user, context={'request': request}).data)


class FriendshipViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendshipSerializer

    def get_queryset(self):
        me = self.request.user
        return Friendship.objects.filter(
            Q(requester=me) | Q(addressee=me)
        ).select_related('requester', 'addressee')

    # GET /friends/
    def list(self, request):
        qs = self.get_queryset().filter(status=Friendship.STATUS_ACCEPTED)
        serializer = FriendshipSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # POST /friends/
    def create(self, request):
        input_ser = FriendshipCreateSerializer(data=request.data, context={'request': request})
        input_ser.is_valid(raise_exception=True)

        addressee_id = input_ser.validated_data['addressee']
        me = request.user

        existing = self._find_pair(me, addressee_id)
        if existing is None:
            try:
                with transaction.atomic():
                    friendship = Friendship.objects.create(requester=me, addressee_id=addressee_id)
            except IntegrityError:
                # A concurrent request for the same pair inserted its row after
                # our lookup; resolve against that row instead
                existing = self._find_pair(me, addressee_id)
                if existing is None:
                    raise
            else:
                notify(friendship.addressee, 'create', 'Friend request', f'{me.full_name} sent you a friend request.', subject=me)
                serializer = FriendshipSerializer(friendship, context={'request': request})
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        # They already asked me (B sending to A when A→B is pending): accept it
        if existing.requester_id == addressee_id and existing.status == Friendship.STATUS_PENDING:
            accept_friendship(existing)
            serializer = FriendshipSerializer(existing, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        raise ValidationError({'detail': 'A friendship or pending request already exists.'})

    # POST /friends/{id}/accept/
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        friendship = self._get_friendship(pk)
        if friendship.addressee != request.user:
            raise PermissionDenied('Only the recipient can accept a friend request.')
        accept_friendship(friendship)
        serializer = FriendshipSerializer(friendship, context={'request': request})
        return Response(serializer.data)

    # DELETE /friends/{id}/   (reject, cancel, or unfriend)
    def destroy(self, request, pk=None):
        friendship = self._get_friendship(pk)
        self._assert_is_party(friendship, request.user)
        # Lock the row so we notify based on the status we actually delete: a
        # concurrent accept waits for us, a concurrent delete then finds no row
        with transaction.atomic():
            current = Friendship.objects.select_for_update().filter(pk=friendship.pk).first()
            if current is None:
                raise NotFound()
            current.delete()
        if current.status == Friendship.STATUS_ACCEPTED:
            notify_both_friends(friendship, 'delete', 'Friend removed', 'You and {name} are no longer friends.')
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET /friends/incoming/
    @action(detail=False, methods=['get'])
    def incoming(self, request):
        qs = Friendship.objects.filter(
            addressee=request.user,
            status=Friendship.STATUS_PENDING,
        ).select_related('requester', 'addressee')
        serializer = FriendshipSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # GET /friends/outgoing/
    @action(detail=False, methods=['get'])
    def outgoing(self, request):
        qs = Friendship.objects.filter(
            requester=request.user,
            status=Friendship.STATUS_PENDING,
        ).select_related('requester', 'addressee')
        serializer = FriendshipSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def _find_pair(self, me, other_id):
        # The unordered-pair constraint allows at most one row per pair
        return Friendship.objects.filter(
            Q(requester=me, addressee_id=other_id) |
            Q(requester_id=other_id, addressee=me)
        ).select_related('requester', 'addressee').first()

    def _get_friendship(self, pk):
        return get_object_or_404(self.get_queryset(), pk=pk)

    def _assert_is_party(self, friendship, user):
        if friendship.requester != user and friendship.addressee != user:
            raise PermissionDenied('You are not part of this friendship.')
