from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Friendship
from .serializers import FriendshipCreateSerializer, FriendshipSerializer


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

        # Check for a reverse pending request (B sending to A when A→B is pending)
        reverse = Friendship.objects.filter(
            requester_id=addressee_id,
            addressee=me,
            status=Friendship.STATUS_PENDING,
        ).first()
        if reverse:
            reverse.status = Friendship.STATUS_ACCEPTED
            reverse.save(update_fields=['status'])
            serializer = FriendshipSerializer(reverse, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Check if a row already exists in either direction
        existing = Friendship.objects.filter(
            Q(requester=me, addressee_id=addressee_id) |
            Q(requester_id=addressee_id, addressee=me)
        ).first()
        if existing:
            raise ValidationError({'detail': 'A friendship or pending request already exists.'})

        friendship = Friendship.objects.create(requester=me, addressee_id=addressee_id)
        serializer = FriendshipSerializer(friendship, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # POST /friends/{id}/accept/
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        friendship = self._get_friendship(pk)
        if friendship.addressee != request.user:
            raise PermissionDenied('Only the recipient can accept a friend request.')
        if friendship.status != Friendship.STATUS_PENDING:
            raise ValidationError({'detail': 'This request is not pending.'})
        friendship.status = Friendship.STATUS_ACCEPTED
        friendship.save(update_fields=['status'])
        serializer = FriendshipSerializer(friendship, context={'request': request})
        return Response(serializer.data)

    # DELETE /friends/{id}/   (reject, cancel, or unfriend)
    def destroy(self, request, pk=None):
        friendship = self._get_friendship(pk)
        self._assert_is_party(friendship, request.user)
        friendship.delete()
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

    def _get_friendship(self, pk):
        return get_object_or_404(self.get_queryset(), pk=pk)

    def _assert_is_party(self, friendship, user):
        if friendship.requester != user and friendship.addressee != user:
            raise PermissionDenied('You are not part of this friendship.')
