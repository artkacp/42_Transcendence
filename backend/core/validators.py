from rest_framework.exceptions import ValidationError


def max_file_size(megabytes):
    def validate(file):
        if file.size > megabytes * 1024 * 1024:
            raise ValidationError(f'File must be {megabytes} MB or smaller.')
    return validate
