from django.db.models import Count

from .models import AGE_BUCKETS, Pet
from .serializers import PetFilterSerializer

LOOKUPS = {
    'q': 'search_text__icontains',
    'age_bucket': 'age_years__range',
    'trait': 'traits__contains',
    'vaccinated': 'is_vaccinated',
    'neutered': 'is_neutered',
}


def visible_pets():
    return (
        Pet.objects.select_related('owner', 'adopted_by')
        .annotate(inquiry_count=Count('inquiries'))
        .order_by('-created_at')
    )


def filter_pets(queryset, query_params):
    # .dict() because DRF treats booleans missing from a QueryDict as False
    filters = PetFilterSerializer(data=query_params.dict())
    filters.is_valid(raise_exception=True)
    for name, value in filters.validated_data.items():
        if name == 'age_bucket':
            value = AGE_BUCKETS[value]
        elif name == 'trait':
            value = [value]
        queryset = queryset.filter(**{LOOKUPS.get(name, name): value})
    return queryset
