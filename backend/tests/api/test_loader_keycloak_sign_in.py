"""POST /loader/session with the loader's Keycloak token instead of a PIN.

The account (users row, role LOADER) is linked to its loader_users row by full
name, trimmed; the first sign-in creates the row. The depot is
loader_users.depot, else the home dock's (read only, never written back).
"""
import uuid

from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.loader_user import LoaderSession, LoaderUser
from app.models.reference import Depot
from app.models.user import User, UserRole
from tests.conftest_loader import (  # noqa: F401  (strict_loader_client is a fixture)
    build_run_021,
    make_dock,
    make_loader,
    strict_loader_client,
)

BASE = "/api/v1/loader"


def account(db, name="Saman Jayawardena", role=UserRole.LOADER, email=None):
    user = User(
        email=email or f"{uuid.uuid4().hex[:8]}@waypoint.com", full_name=name,
        hashed_password=get_password_hash("pw123456"), role=role, is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def sign_in(client, user, **body):
    return client.post(
        f"{BASE}/session", json=body, headers={"Authorization": f"Bearer {create_access_token(user.id)}"}
    )


def loaders_named(db, name):
    return db.execute(select(LoaderUser).where(func.trim(LoaderUser.full_name) == name)).scalars().all()


def test_a_loader_signs_in_with_their_token_and_no_pin(strict_loader_client, db_session):
    loader = make_loader(db_session)
    user = account(db_session)

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["loader"], body["depot"], body["ended_at"]) == (
        {"id": loader.id, "short_name": "Saman J."}, "peliyagoda", None,
    )
    assert db_session.get(LoaderSession, body["session_id"]).loader_user_id == loader.id


def test_the_name_matches_with_spaces_trimmed(strict_loader_client, db_session):
    loader = make_loader(db_session, "sachintha ", "sachintha")  # as Admin saved it
    user = account(db_session, "sachintha")

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 200, response.text
    assert response.json()["loader"]["id"] == loader.id


def test_the_first_sign_in_creates_the_loader_row(strict_loader_client, db_session):
    make_dock(db_session)
    user = account(db_session, "Kasun Bandara")
    assert loaders_named(db_session, "Kasun Bandara") == []

    response = sign_in(strict_loader_client, user)

    # Created with no depot: the next step is the admin's.
    assert response.status_code == 403, response.text
    assert response.json()["detail"]["code"] == "LOADER_NO_DEPOT"
    [created] = loaders_named(db_session, "Kasun Bandara")
    assert (created.short_name, created.is_active, created.depot) == ("Kasun B.", True, None)

    created.depot = Depot.PELIYAGODA
    db_session.flush()
    again = sign_in(strict_loader_client, user)
    assert again.status_code == 200, again.text
    assert again.json()["loader"]["id"] == created.id
    assert len(loaders_named(db_session, "Kasun Bandara")) == 1  # not created twice


def test_two_loaders_with_the_name_are_refused(strict_loader_client, db_session):
    first = make_loader(db_session, "Nimal Silva", "Nimal S.")
    second = make_loader(db_session, "Nimal Silva ", "Nimal S.")
    user = account(db_session, "Nimal Silva")

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 409, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "LOADER_ACCOUNT_AMBIGUOUS"
    assert detail["loader_user_ids"] == [first.id, second.id]
    assert "More than one loader is called 'Nimal Silva'" in detail["message"]


def test_another_role_is_a_403_and_creates_nothing(strict_loader_client, db_session):
    user = account(db_session, "Kasun Perera", role=UserRole.DISPATCHER)

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "NOT_A_LOADER"
    assert loaders_named(db_session, "Kasun Perera") == []


def test_no_depot_and_no_home_dock_is_a_clear_403(strict_loader_client, db_session):
    make_loader(db_session, "Umesh Perera", "Umesh P.", depot=None)
    user = account(db_session, "Umesh Perera")

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "LOADER_NO_DEPOT"
    assert detail["message"] == "Your account isn't assigned to a depot yet. Ask the admin to set it."


def test_the_home_docks_depot_is_used_and_not_written_back(strict_loader_client, db_session):
    kandy = make_dock(db_session, "DCK-KAN-ANY", "Any Dock (Dispatcher Assigned)", depot=Depot.KANDY)
    loader = make_loader(db_session, "Gemba Gmeba", "Gemba", depot=None)
    loader.home_dock_id = kandy.id
    user = account(db_session, "Gemba Gmeba")
    db_session.flush()

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 200, response.text
    assert response.json()["depot"] == "kandy"
    db_session.refresh(loader)
    assert loader.depot is None


def test_a_switched_off_loader_is_refused(strict_loader_client, db_session):
    make_loader(db_session).is_active = False
    user = account(db_session)

    response = sign_in(strict_loader_client, user)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "LOADER_INACTIVE"


def test_without_a_token_the_pin_is_refused_unless_switched_on(strict_loader_client, db_session, monkeypatch):
    loader = make_loader(db_session)
    pin = {"loader_user_id": loader.id, "pin": "4417"}

    refused = strict_loader_client.post(f"{BASE}/session", json=pin)
    monkeypatch.setattr(settings, "LOADER_PIN_SIGN_IN", True)
    allowed = strict_loader_client.post(f"{BASE}/session", json=pin)

    assert refused.status_code == 401
    assert refused.json()["detail"]["code"] == "NOT_AUTHENTICATED"
    assert allowed.status_code == 200, allowed.text


def test_a_keycloak_session_works_the_queue_pick_and_checklist(strict_loader_client, db_session):
    client = strict_loader_client
    run, _ = build_run_021(db_session)  # its loader is Saman Jayawardena, Peliyagoda
    user = account(db_session)
    session_id = sign_in(client, user).json()["session_id"]
    tablet = {"X-Loader-Session": str(session_id)}

    queue = client.get(f"{BASE}/runs", headers=tablet)
    picked = client.post(f"{BASE}/runs/{run.code}/pick", json={"loader_session_id": session_id})
    checklist = client.get(f"{BASE}/runs/{run.code}", headers=tablet)
    ended = client.request("DELETE", f"{BASE}/session/{session_id}", json={"end_reason": "sign_out"})

    assert queue.status_code == 200, queue.text
    assert [c["code"] for d in queue.json()["docks"] for c in d["runs"]] == [run.code]
    assert picked.status_code == 200, picked.text
    assert checklist.status_code == 200, checklist.text
    assert checklist.json()["picked_by"] == "Saman J."
    assert ended.status_code == 200 and ended.json()["end_reason"] == "sign_out"
