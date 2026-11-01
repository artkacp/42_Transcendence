from pathlib import Path

from rest_framework import serializers

from accounts.serializers import UserMinimalSerializer
from core.validators import max_file_size
from pets.serializers import PetSerializer

from .models import ALLOWED_TYPES, MAX_MESSAGE_LENGTH, STAGE_CHOICES, Attachment, Inquiry, Message


class AttachmentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, validators=[max_file_size(5)])

    class Meta:
        model = Attachment
        fields = ['id', 'file', 'original_name', 'content_type', 'size_bytes', 'kind', 'created_at']
        read_only_fields = ['original_name', 'content_type', 'size_bytes', 'kind']

    def validate_file(self, file):
        if Path(file.name).suffix.lower() not in ALLOWED_TYPES:
            raise serializers.ValidationError('File type is not allowed.')
        return file

    def create(self, validated_data):
        file = validated_data['file']
        content_type = ALLOWED_TYPES[Path(file.name).suffix.lower()]
        return Attachment.objects.create(
            **validated_data,
            original_name=file.name,
            content_type=content_type,
            size_bytes=file.size,
            kind='image' if content_type.startswith('image/') else 'document',
        )


class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'inquiry', 'sender', 'body', 'attachments', 'created_at']


class MessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(allow_blank=True, required=False, default='', max_length=MAX_MESSAGE_LENGTH)
    attachment_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


class MessageHistorySerializer(serializers.Serializer):
    before = serializers.UUIDField(required=False)


class StageSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(choices=STAGE_CHOICES)


class AdoptSerializer(serializers.Serializer):
    inquiry_id = serializers.UUIDField()


class InquirySerializer(serializers.ModelSerializer):
    pet = PetSerializer(read_only=True)
    adopter = UserMinimalSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Inquiry
        fields = ['id', 'pet', 'adopter', 'stage', 'last_message', 'last_message_at', 'created_at']

    def get_last_message(self, obj):
        message = obj.messages.order_by('-created_at').first()
        return MessageSerializer(message, context=self.context).data if message else None
