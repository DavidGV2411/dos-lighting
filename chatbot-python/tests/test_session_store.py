from datetime import UTC, datetime, timedelta

from app.session_store import SessionStore


def test_creates_session_when_none_is_provided():
    store = SessionStore(ttl_minutes=30)

    session, reset = store.get_or_create(None)

    assert session.session_id
    assert reset is False
    assert session.history == []


def test_reuses_existing_session_before_expiry():
    clock = {"now": datetime(2026, 3, 18, 19, 0, tzinfo=UTC)}
    store = SessionStore(ttl_minutes=30, now_provider=lambda: clock["now"])

    session, _ = store.get_or_create(None)
    original_id = session.session_id

    clock["now"] = clock["now"] + timedelta(minutes=10)
    same_session, reset = store.get_or_create(original_id)

    assert same_session.session_id == original_id
    assert reset is False


def test_expired_session_returns_new_id_and_reset_flag():
    clock = {"now": datetime(2026, 3, 18, 19, 0, tzinfo=UTC)}
    store = SessionStore(ttl_minutes=30, now_provider=lambda: clock["now"])

    session, _ = store.get_or_create(None)
    old_id = session.session_id

    clock["now"] = clock["now"] + timedelta(minutes=31)
    new_session, reset = store.get_or_create(old_id)

    assert new_session.session_id != old_id
    assert reset is True
