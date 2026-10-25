from rest_framework import mixins, viewsets

from .serializers import APIKeyCreateSerializer, APIKeySerializer


class APIKeyViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    # Only the caller's keys, so another user's key id is a 404 rather than a 403.
    def get_queryset(self):
        return self.request.user.api_keys.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return APIKeyCreateSerializer
        return APIKeySerializer

    # POST /keys/
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # DELETE /keys/{id}/ (revokes and keeps the row)
    def perform_destroy(self, api_key):
        api_key.revoked = True
        api_key.save(update_fields=['revoked'])
