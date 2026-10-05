from rest_framework.exceptions import ValidationError
from rest_framework.settings import api_settings
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ValidationError):
        fields = response.data
        if not isinstance(fields, dict):
            fields = {api_settings.NON_FIELD_ERRORS_KEY: fields}
        response.data = {
            'error': 'validation_failed',
            'detail': fields.pop('detail', 'Invalid input.'),
            'fields': fields,
        }
    else:
        detail = response.data['detail']
        response.data = {'error': detail.code, 'detail': detail}
    return response
