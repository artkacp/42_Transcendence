import uuid

from sqlalchemy import func

from analytics.db.engine import Session
from analytics.db.models import Event


def get_user_analytics(user_id: uuid.UUID) -> dict:
    session = Session()
    try:
        uid = str(user_id)

        def count_by_type_and_actor(event_type: str) -> int:
            return (
                session.query(func.count())
                .filter(Event.event_type == event_type, Event.user_id == user_id)
                .scalar()
            )

        def count_by_type_and_owner(event_type: str) -> int:
            return (
                session.query(func.count())
                .filter(
                    Event.event_type == event_type,
                    Event.event_metadata['owner_id'].as_string() == uid,
                )
                .scalar()
            )

        return {
            'as_seeker': {
                'pets_viewed': count_by_type_and_actor('visit'),
                'applications_sent': count_by_type_and_actor('application'),
                'adoptions_completed': count_by_type_and_actor('adoption'),
            },
            'as_rehomer': {
                'listings_published': count_by_type_and_actor('listing_published'),
                'views_received': count_by_type_and_owner('visit'),
                'inquiries_received': count_by_type_and_owner('application'),
                'pets_adopted_out': count_by_type_and_owner('adoption'),
            },
        }
    finally:
        session.close()
