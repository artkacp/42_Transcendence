from rest_framework.exceptions import ValidationError

# File extension -> content type stored and served on download
ALLOWED_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

ATTACHMENT_CONTENT_TYPES = [
    *ALLOWED_TYPES.values(),
    'application/vnd.ms-excel',  # what Windows browsers send for .csv
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
