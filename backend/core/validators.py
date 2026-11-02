from rest_framework.exceptions import ValidationError

ATTACHMENT_CONTENT_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.ms-excel',  # what Windows browsers send for .csv
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
PET_PHOTO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
AVATAR_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

CONTENT_TYPES = {
    'attachment': ATTACHMENT_CONTENT_TYPES,
    'pet_photo': PET_PHOTO_CONTENT_TYPES,
    'avatar': AVATAR_CONTENT_TYPES,
}


def max_file_size(megabytes):
    def validate(file):
        if file.size > megabytes * 1024 * 1024:
            raise ValidationError(f'File must be {megabytes} MB or smaller.')
    return validate


def allowed_content_type(kind):
    allowed = CONTENT_TYPES[kind]

    def validate(file):
        if file.content_type not in allowed:
            raise ValidationError('File type is not allowed.')
    return validate
