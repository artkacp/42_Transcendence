import logging
import uuid

from django.db import transaction

from analytics.db.engine import Session
from analytics.db.models import Event
from core import realtime

logger = logging.getLogger(__name__)


def _pet_metadata(pet):
    return {
        'owner_id': str(pet.owner_id),
        'species': pet.species,
        'breed': pet.breed,
        'age_years': pet.age_years,
        'size': pet.size,
        'sex': pet.sex,
        'city': pet.city,
        'is_vaccinated': pet.is_vaccinated,
        'is_neutered': pet.is_neutered,
        'traits': list(pet.traits),
    }


def _write_event(user_id, pet_id, event_type, metadata):
    session = Session()
    try:
        session.add(Event(
            id=uuid.uuid4(),
            user_id=user_id,
            pet_id=pet_id,
            event_type=event_type,
            event_metadata=metadata,
        ))
        session.commit()
    except Exception:
        session.rollback()
        logger.exception(
            "analytics_event write failed: type=%s user=%s", event_type, user_id
        )
    finally:
        session.close()


def handle_pet_viewed(sender, user, pet, **kwargs):
    uid, pid, meta = user.id, pet.id, _pet_metadata(pet)
    transaction.on_commit(lambda: _write_event(uid, pid, 'visit', meta))


def _ping():
    realtime.push('analytics', 'analytics.ping')


def handle_inquiry_opened(sender, user, pet, **kwargs):
    uid, pid, meta = user.id, pet.id, _pet_metadata(pet)
    transaction.on_commit(lambda: _write_event(uid, pid, 'application', meta))
    transaction.on_commit(_ping)


def handle_message_sent(sender, user, pet, **kwargs):
    uid, pid, meta = user.id, pet.id, _pet_metadata(pet)
    transaction.on_commit(lambda: _write_event(uid, pid, 'message', meta))
    transaction.on_commit(_ping)


def handle_adoption_completed(sender, user, pet, **kwargs):
    uid, pid, meta = user.id, pet.id, _pet_metadata(pet)
    transaction.on_commit(lambda: _write_event(uid, pid, 'adoption', meta))
    transaction.on_commit(_ping)


def handle_listing_published(sender, user, pet, **kwargs):
    uid, pid, meta = user.id, pet.id, _pet_metadata(pet)
    transaction.on_commit(lambda: _write_event(uid, pid, 'listing_published', meta))
    transaction.on_commit(_ping)


def handle_user_registered(sender, user, **kwargs):
    uid = user.id
    transaction.on_commit(lambda: _write_event(uid, None, 'registered', {}))
    transaction.on_commit(_ping)
