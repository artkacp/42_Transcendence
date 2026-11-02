from rest_framework import serializers


# A browser's multipart body sends each line break of a textarea as \r\n, while the textarea's
# maxLength and counter see a single \n. Store \n only and check min/max length on that, so a line
# break counts as one character whatever the client sends.
class MultilineCharField(serializers.CharField):
    def to_internal_value(self, data):
        return super().to_internal_value(data).replace('\r\n', '\n').replace('\r', '\n')
