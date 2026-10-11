import uuid
from pathlib import Path

from django.utils.deconstruct import deconstructible


@deconstructible
class UploadTo:
    # Server-generated file names: the uploader's original name never reaches the public URL
    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        return f'{self.folder}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'
