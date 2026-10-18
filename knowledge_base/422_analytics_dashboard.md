# 422 — Analytics Dashboard Endpoint

API contract and metric definitions for the platform analytics dashboard. This covers the Advanced analytics dashboard Major module (A4).

---

## GET /api/analytics/platform/

Returns all KPIs and chart series in one response. Private — requires authentication.

### Query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | ISO date | Range start (inclusive) |
| `end` | ISO date | Range end (inclusive) |
| `species` | string | Pet feature filter — `dog` or `cat` |
| `sex` | string | Pet feature filter |
| `size` | string | Pet feature filter |
| `age_bucket` | string | Pet feature filter |
| `city` | string | Pet feature filter |
| `breed` | string | Pet feature filter |
| `trait` | string | Pet feature filter |
| `vaccinated` | boolean | Pet feature filter |
| `neutered` | boolean | Pet feature filter |

All parameters are optional. Without a date range the endpoint returns all-time data. Pet feature filters are applied via the `metadata` JSONB snapshot on `analytics_event` — the same fixed vocabularies used by Browse and Rehome.

---

## Metric definitions (Q-23 resolved 2026-10-17)

All counts are scoped to the selected date range (filtered on `occurred_at`).

| Metric | Definition | Event type |
|--------|-----------|------------|
| Active user | Any user who performed at least one event in the period | any |
| Seeker | Any user who viewed at least one pet in the period | `visit` |
| Rehomer | Any user who published at least one listing in the period | `listing_published` |

**A user can be counted as both seeker and rehomer on the same day** — the roles are not mutually exclusive. The "seekers vs rehomers per day" chart counts each independently.

---

## KPI row

| KPI | Definition |
|-----|-----------|
| Listing visits | `COUNT` of `visit` events in period |
| Applications | `COUNT` of `application` events in period |
| Adoptions | `COUNT` of `adoption` events in period |
| Messages | `COUNT` of `message` events in period |

Each KPI includes a period-over-period delta (current period vs previous period of equal length).

---

## Chart series (8 total)

| Chart | Type | Description |
|-------|------|-------------|
| Listing visits over time | Area | Daily `COUNT` of `visit` events |
| Adoptions by species | Pie | `COUNT DISTINCT pet_id` where `event_type = 'adoption'`, grouped by `metadata->>'species'` |
| Offers over time | Area | Daily `COUNT` of `listing_published` events, with running total |
| Users over time | Lines | Daily active users + daily new sign-ups (`registered` events), with totals |
| Seekers vs rehomers per day | Areas | Daily `COUNT DISTINCT user_id` for `visit` events vs `listing_published` events |
| Applications per adopted pet | Bars | Distribution: for each adopted pet, count how many `application` events it received; bucket into 1/2/3/4/5+, show average |
| Applications vs adoptions | Grouped bars | Daily `COUNT` of `application` events vs `adoption` events |
| Community messages | Line | Daily `COUNT` of `message` events |

---

## Data source

All queries run against the `analytics_event` table via Django ORM (read-only access — see note 520, Q-26). Pet feature filters are applied as JSONB conditions on the `metadata` column. `COUNT DISTINCT` is used wherever unique users or pets are needed.

---

## References

- Note 421 — Per-user analytics endpoint (`/api/analytics/me/`)
- Note 520 — SQLAlchemy setup and `analytics_event` schema
- Note 530 — Data modeling (JSONB metadata snapshot)
- Q-26 — Django read access on `analytics_event` confirmed
