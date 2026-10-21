import re

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_engine = None
_Session = None


def _sa_url() -> str:
    # Derive the connection URL from Django's CURRENT connection settings.
    # This makes the engine test-DB-aware: Django's test runner remaps its
    # connection to test_<dbname>, and we pick that up here instead of
    # reading the URL from the environment (which always names the non-test DB).
    from django.db import connection
    db = connection.settings_dict
    host = db.get('HOST') or 'localhost'
    port = db.get('PORT') or '5432'
    raw = f"postgresql://{db['USER']}:{db['PASSWORD']}@{host}:{port}/{db['NAME']}"
    return re.sub(r'^postgres(?:ql)?://', 'postgresql+psycopg://', raw)


def _ensure_engine():
    global _engine, _Session
    if _engine is None:
        _engine = create_engine(_sa_url(), pool_pre_ping=True)
        _Session = sessionmaker(bind=_engine)


class _EngineHandle:
    """Thin proxy so callers can write engine.dispose() without holding a real engine reference."""
    def dispose(self):
        global _engine, _Session
        if _engine is not None:
            _engine.dispose()
        _engine = None
        _Session = None


class _SessionFactory:
    """Thin proxy so callers can write Session() without holding a real sessionmaker reference."""
    def __call__(self):
        _ensure_engine()
        return _Session()


engine = _EngineHandle()
Session = _SessionFactory()


class Base(DeclarativeBase):
    pass
