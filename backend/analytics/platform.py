from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from django.db.models import Count, Q
from django.db.models.functions import TruncDay
from rest_framework.exceptions import ValidationError

from analytics.models import AnalyticsEvent
from pets.models import AGE_BUCKETS


@dataclass
class FilterParams:
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    species: Optional[str] = None
    sex: Optional[str] = None
    size: Optional[str] = None
    age_bucket: Optional[str] = None
    city: Optional[str] = None
    breed: Optional[str] = None
    trait: Optional[str] = None
    vaccinated: Optional[bool] = None
    neutered: Optional[bool] = None


def parse_filter_params(query_params) -> FilterParams:
    params = FilterParams()

    start_str = query_params.get('start')
    end_str = query_params.get('end')

    if start_str:
        try:
            d = date.fromisoformat(start_str)
            params.start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
        except ValueError:
            raise ValidationError({'start': 'Use YYYY-MM-DD format.'})

    if end_str:
        try:
            d = date.fromisoformat(end_str)
            next_day = d + timedelta(days=1)
            params.end = datetime(next_day.year, next_day.month, next_day.day, 0, 0, 0, tzinfo=timezone.utc)
        except ValueError:
            raise ValidationError({'end': 'Use YYYY-MM-DD format.'})

    if params.start and params.end and params.start >= params.end:
        raise ValidationError({'end': 'end must be after start.'})

    age_bucket = query_params.get('age_bucket')
    if age_bucket:
        if age_bucket not in AGE_BUCKETS:
            raise ValidationError({'age_bucket': f'Choose from: {list(AGE_BUCKETS)}.'})
        params.age_bucket = age_bucket

    for name in ('vaccinated', 'neutered'):
        val = query_params.get(name)
        if val is not None:
            if val.lower() == 'true':
                setattr(params, name, True)
            elif val.lower() == 'false':
                setattr(params, name, False)
            else:
                raise ValidationError({name: 'Must be true or false.'})

    for name in ('species', 'sex', 'size', 'city', 'breed', 'trait'):
        val = query_params.get(name)
        if val:
            setattr(params, name, val)

    return params


def build_date_qs(params: FilterParams):
    """Date-range-only queryset — no pet filters. Used for metrics that are
    platform-level and should not be suppressed by pet feature filters."""
    qs = AnalyticsEvent.objects.all()
    if params.start:
        qs = qs.filter(occurred_at__gte=params.start)
    if params.end:
        qs = qs.filter(occurred_at__lt=params.end)
    return qs


def build_base_qs(params: FilterParams):
    qs = AnalyticsEvent.objects.all()

    if params.start:
        qs = qs.filter(occurred_at__gte=params.start)
    if params.end:
        qs = qs.filter(occurred_at__lt=params.end)
    if params.species:
        qs = qs.filter(metadata__species=params.species)
    if params.sex:
        qs = qs.filter(metadata__sex=params.sex)
    if params.size:
        qs = qs.filter(metadata__size=params.size)
    if params.city:
        qs = qs.filter(metadata__city=params.city)
    if params.breed:
        qs = qs.filter(metadata__breed=params.breed)
    if params.trait:
        qs = qs.filter(metadata__traits__contains=[params.trait])
    if params.vaccinated is not None:
        qs = qs.filter(metadata__is_vaccinated=params.vaccinated)
    if params.neutered is not None:
        qs = qs.filter(metadata__is_neutered=params.neutered)
    if params.age_bucket:
        lo, hi = AGE_BUCKETS[params.age_bucket]
        qs = qs.filter(metadata__age_years__gte=lo, metadata__age_years__lte=hi)

    return qs


def _previous_window(params: FilterParams):
    if params.start is None or params.end is None:
        return None, None
    delta = params.end - params.start
    prev_end = params.start
    prev_start = prev_end - delta
    return prev_start, prev_end


def _kpi_counts(qs) -> dict:
    return qs.aggregate(
        listing_visits=Count('id', filter=Q(event_type='visit')),
        applications=Count('id', filter=Q(event_type='application')),
        adoptions=Count('id', filter=Q(event_type='adoption')),
        messages=Count('id', filter=Q(event_type='message')),
    )


def compute_kpis(base_qs, params: FilterParams) -> dict:
    current = _kpi_counts(base_qs)

    prev_start, prev_end = _previous_window(params)
    if prev_start is not None:
        prev_params = FilterParams(
            start=prev_start, end=prev_end,
            species=params.species, sex=params.sex, size=params.size,
            age_bucket=params.age_bucket, city=params.city, breed=params.breed,
            trait=params.trait, vaccinated=params.vaccinated, neutered=params.neutered,
        )
        previous = _kpi_counts(build_base_qs(prev_params))
    else:
        previous = {k: None for k in current}

    result = {}
    for key in current:
        curr = current[key]
        prev = previous[key]
        if prev is not None:
            delta_abs = curr - prev
            delta_pct = round(delta_abs / prev * 100, 1) if prev > 0 else None
        else:
            delta_abs = None
            delta_pct = None
        result[key] = {'value': curr, 'delta_abs': delta_abs, 'delta_pct': delta_pct}

    return result


def _by_day(qs, event_type=None, count_distinct=None) -> dict:
    """Returns {date: int} dict. count_distinct names a field for COUNT DISTINCT."""
    filtered = qs.filter(event_type=event_type) if event_type else qs
    count_expr = Count(count_distinct, distinct=True) if count_distinct else Count('id')
    return {
        r['day'].date(): r['count']
        for r in (
            filtered
            .annotate(day=TruncDay('occurred_at'))
            .values('day')
            .annotate(count=count_expr)
            .order_by('day')
        )
    }


def _merge_days(keys_and_dicts: list) -> list:
    """Merge multiple {date: int} dicts into a sorted list of day dicts."""
    all_days = sorted(set().union(*[d.keys() for _, d in keys_and_dicts]))
    return [
        {'date': day.isoformat(), **{key: d.get(day, 0) for key, d in keys_and_dicts}}
        for day in all_days
    ]


def chart_listing_visits_over_time(base_qs) -> list:
    daily = _by_day(base_qs, event_type='visit')
    return [{'date': d.isoformat(), 'count': c} for d, c in sorted(daily.items())]


def chart_adoptions_by_species(base_qs) -> list:
    rows = (
        base_qs.filter(event_type='adoption')
        .values('metadata__species')
        .annotate(count=Count('pet_id', distinct=True))
        .order_by('-count')
    )
    return [{'species': r['metadata__species'], 'count': r['count']} for r in rows]


def chart_offers_over_time(base_qs) -> list:
    daily = _by_day(base_qs, event_type='listing_published')
    running = 0
    result = []
    for d, count in sorted(daily.items()):
        running += count
        result.append({'date': d.isoformat(), 'count': count, 'running_total': running})
    return result


def chart_users_over_time(base_qs, date_qs) -> list:
    return _merge_days([
        ('active_users', _by_day(base_qs, count_distinct='user_id')),
        ('new_signups', _by_day(date_qs, event_type='registered')),
    ])


def chart_seekers_vs_rehomers(base_qs) -> list:
    return _merge_days([
        ('seekers', _by_day(base_qs, event_type='visit', count_distinct='user_id')),
        ('rehomers', _by_day(base_qs, event_type='listing_published', count_distinct='user_id')),
    ])


def chart_applications_per_adopted_pet(base_qs) -> dict:
    adopted_pet_ids = list(
        base_qs.filter(event_type='adoption', pet_id__isnull=False)
        .values_list('pet_id', flat=True)
        .distinct()
    )
    if not adopted_pet_ids:
        return {'distribution': [], 'average': None}

    per_pet = list(
        base_qs.filter(event_type='application', pet_id__in=adopted_pet_ids)
        .values('pet_id')
        .annotate(app_count=Count('id'))
    )

    buckets = {'1': 0, '2': 0, '3': 0, '4': 0, '5+': 0}
    total_apps = 0
    for row in per_pet:
        c = row['app_count']
        total_apps += c
        key = str(c) if c <= 4 else '5+'
        buckets[key] += 1

    return {
        'distribution': [{'bucket': k, 'count': v} for k, v in buckets.items()],
        'average': round(total_apps / len(per_pet), 2) if per_pet else None,
    }


def chart_applications_vs_adoptions(base_qs) -> list:
    return _merge_days([
        ('applications', _by_day(base_qs, event_type='application')),
        ('adoptions', _by_day(base_qs, event_type='adoption')),
    ])


def chart_community_messages(base_qs) -> list:
    daily = _by_day(base_qs, event_type='message')
    return [{'date': d.isoformat(), 'count': c} for d, c in sorted(daily.items())]


def get_platform_analytics(params: FilterParams) -> dict:
    base_qs = build_base_qs(params)
    date_qs = build_date_qs(params)
    return {
        'kpis': compute_kpis(base_qs, params),
        'charts': {
            'listing_visits_over_time': chart_listing_visits_over_time(base_qs),
            'adoptions_by_species': chart_adoptions_by_species(base_qs),
            'offers_over_time': chart_offers_over_time(base_qs),
            'users_over_time': chart_users_over_time(base_qs, date_qs),
            'seekers_vs_rehomers': chart_seekers_vs_rehomers(base_qs),
            'applications_per_adopted_pet': chart_applications_per_adopted_pet(base_qs),
            'applications_vs_adoptions': chart_applications_vs_adoptions(base_qs),
            'community_messages': chart_community_messages(base_qs),
        },
    }
