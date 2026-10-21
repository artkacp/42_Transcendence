# 421 — Analytics Endpoints

API contract for the per-user analytics endpoint. This covers the User activity analytics Minor module — the platform-wide Prometheus/Grafana dashboard is a separate concern (see notes 400, 520).

---

## GET /api/analytics/me/

Returns the authenticated user's own activity stats. Private — no other user's data is returned and no other user can access this endpoint's data.

### Scope

All-time totals. No date filtering at this endpoint — rolling windows and breakdowns are handled by the platform analytics dashboard.

### Response shape

```json
{
  "as_seeker": {
    "pets_viewed": 0,
    "applications_sent": 0,
    "adoptions_completed": 0
  },
  "as_rehomer": {
    "listings_published": 0,
    "views_received": 0,
    "inquiries_received": 0,
    "pets_adopted_out": 0
  }
}
```

Both sections are always present. A user who has never listed a pet will have all-zero rehomer stats.

### Data source

All counts come from the `analytics_event` table, queried via SQLAlchemy. Event types used:

| Field | Event type | Filter |
|-------|-----------|--------|
| `pets_viewed` | `visit` | `user_id = me` |
| `applications_sent` | `application` | `user_id = me` |
| `adoptions_completed` | `adoption` | `user_id = me` (as adopter) |
| `listings_published` | `listing_published` | `user_id = me` |
| `views_received` | `visit` | `metadata->>'owner_id' = me` |
| `inquiries_received` | `application` | `metadata->>'owner_id' = me` |
| `pets_adopted_out` | `adoption` | `metadata->>'owner_id' = me` |

The `metadata` JSONB column stores a snapshot of the pet's context at event time, including the owner's user ID. This makes rehomer stats survivable after a pet is deleted.

### Authentication

Standard JWT authentication. Unauthenticated requests return 401.

---

## References

- Note 520 — SQLAlchemy setup and `analytics_event` table schema
- Note 530 — Data modeling (JSONB metadata snapshot)
- Note 410 — General API conventions
