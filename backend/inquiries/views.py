from django.db.models import Q
from django.http import FileResponse
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from .models import Attachment
from .serializers import AttachmentSerializer, InquirySerializer, MessageCreateSerializer, MessageHistorySerializer, MessageSerializer
from .services import newest_first, participant_inquiries, send_message, sweep_stale_attachments

MESSAGE_PAGE_SIZE = 30


class InquiryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = InquirySerializer

    # GET /inquiries/ (the caller's threads as adopter)
    def get_queryset(self):
        return newest_first(self.request.user.inquiries.select_related('pet__owner', 'adopter'))

    # GET /inquiries/{id}/messages/?before=  ·  POST /inquiries/{id}/messages/ (REST fallback)
    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        if request.method == 'POST':
            data = MessageCreateSerializer(data=request.data)
            data.is_valid(raise_exception=True)
            message = send_message(request.user, pk, **data.validated_data)
            return Response(MessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)

        inquiry = get_object_or_404(participant_inquiries(request.user), pk=pk)
        query = MessageHistorySerializer(data=request.query_params.dict())
        query.is_valid(raise_exception=True)
        messages = inquiry.messages.select_related('sender').prefetch_related('attachments').order_by('-created_at')
        if 'before' in query.validated_data:
            before = get_object_or_404(inquiry.messages, pk=query.validated_data['before'])
            messages = messages.filter(created_at__lt=before.created_at)
        return Response(MessageSerializer(messages[:MESSAGE_PAGE_SIZE], many=True, context={'request': request}).data)


class AttachmentViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = AttachmentSerializer

    # Only staged uploads of the caller can be unstaged
    def get_queryset(self):
        return self.request.user.attachments.filter(message=None)

    # POST /attachments/
    def perform_create(self, serializer):
        sweep_stale_attachments(self.request.user)
        serializer.save(uploaded_by=self.request.user)

    # DELETE /attachments/{id}/
    def perform_destroy(self, attachment):
        attachment.file.delete(save=False)
        attachment.delete()

    # GET /attachments/{id}/download/
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        visible = Attachment.objects.filter(
            Q(uploaded_by=request.user) | Q(message__inquiry__in=participant_inquiries(request.user))
        )
        attachment = get_object_or_404(visible, pk=pk)
        return FileResponse(attachment.file.open('rb'), content_type=attachment.content_type, filename=attachment.original_name)
