"""L2: GET /loader/users, POST /loader/session, DELETE /loader/session/{id}.

Loaders belong to a depot (loader_users.depot): the tablet lists the loaders of
the depot it signs into, and a session sees every dock of that depot.
"""
import uuid

from sqlalchemy import select

from app.models.loader_activity import LoadingCheck
from app.models.loader_user import LoaderSession, SessionEndReason
from app.models.reference import Depot, DockTablet
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    build_run_021,
    loader_client,
    make_dock,
    make_loader,
)

BASE = "/api/v1/loader"
TABLET = "Dock tablet 3"


def register_tablet(db, dock, label=TABLET, active=True):
    tablet = DockTablet(label=label, dock_id=dock.id, is_active=active)
    db.add(tablet)
    db.flush()
    return tablet


def sign_in(client, user_id, pin="4417", tablet=None, depot="peliyagoda"):
    body = {"loader_user_id": user_id, "pin": pin, "depot": depot}
    if tablet is not None:
        body["dock_tablet_label"] = tablet
    return client.post(f"{BASE}/session", json=body)


def users(client, **params):
    return client.get(f"{BASE}/users", params={"depot": "peliyagoda", **params})


def end(client, session_id, reason="sign_out"):
    # httpx's delete() takes no json=, so go through request().
    return client.request("DELETE", f"{BASE}/session/{session_id}", json={"end_reason": reason})


# --- GET /loader/users ---------------------------------------------------------


def test_users_are_the_active_loaders_by_full_name_without_pins(loader_client, db_session):
    make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    make_loader(db_session, "Saman Jayawardena", "Saman J.")
    make_loader(db_session, "Retired Loader", "Retired L.").is_active = False
    db_session.flush()

    response = users(loader_client)

    assert response.status_code == 200, response.text
    body = response.json()
    assert [u["short_name"] for u in body] == ["Saman J.", "Tharindu J."]
    assert all(set(u) == {"id", "full_name", "short_name"} for u in body)


def test_users_can_be_searched_by_full_or_short_name(loader_client, db_session):
    make_loader(db_session, "Saman Jayawardena", "Saman J.")
    make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    db_session.flush()

    by_full = users(loader_client, q="jayasur").json()
    by_short = users(loader_client, q="saman j.").json()
    blank = users(loader_client, q="  ").json()

    assert [u["short_name"] for u in by_full] == ["Tharindu J."]
    assert [u["short_name"] for u in by_short] == ["Saman J."]
    assert len(blank) == 2


def test_users_are_only_the_depots_being_signed_into(loader_client, db_session):
    make_loader(db_session, "Saman Jayawardena", "Saman J.")
    make_loader(db_session, "Kasun Bandara", "Kasun B.", depot=Depot.KANDY)
    make_loader(db_session, "No Depot", "No D.", depot=None)
    db_session.flush()

    peliyagoda = users(loader_client).json()
    kandy = users(loader_client, depot="kandy").json()

    assert [u["short_name"] for u in peliyagoda] == ["Saman J."]
    assert [u["short_name"] for u in kandy] == ["Kasun B."]
    assert loader_client.get(f"{BASE}/users").status_code == 422  # the depot is required


# --- POST /loader/session --------------------------------------------------------


def test_sign_in_opens_a_session_at_the_loaders_depot(loader_client, db_session):
    saman = make_loader(db_session)
    db_session.flush()

    response = sign_in(loader_client, saman.id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["loader"] == {"id": saman.id, "short_name": "Saman J."}
    assert (body["dock"], body["depot"]) == (None, "peliyagoda")
    assert body["started_at"].endswith("Z")
    assert (body["ended_at"], body["end_reason"]) == (None, None)
    stored = db_session.get(LoaderSession, body["session_id"])
    assert stored.loader_user_id == saman.id and stored.ended_at is None
    assert stored.dock_tablet_id is None


def test_a_registered_tablet_is_recorded_when_sent(loader_client, db_session):
    tablet = register_tablet(db_session, make_dock(db_session))
    saman = make_loader(db_session)
    db_session.flush()

    body = sign_in(loader_client, saman.id, tablet=TABLET).json()

    assert db_session.get(LoaderSession, body["session_id"]).dock_tablet_id == tablet.id


def test_a_loader_with_no_depot_cannot_sign_in(loader_client, db_session):
    nodepot = make_loader(db_session, "No Depot", "No D.", depot=None)
    db_session.flush()

    response = sign_in(loader_client, nodepot.id)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "LOADER_NO_DEPOT"
    assert db_session.query(LoaderSession).count() == 0


def test_signing_in_at_another_depot_is_refused(loader_client, db_session):
    kasun = make_loader(db_session, "Kasun Bandara", "Kasun B.", depot=Depot.KANDY)
    db_session.flush()

    response = sign_in(loader_client, kasun.id, depot="peliyagoda")

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "LOADER_OTHER_DEPOT"


def test_a_wrong_pin_is_a_401_the_tablet_understands(loader_client, db_session):
    register_tablet(db_session, make_dock(db_session))
    saman = make_loader(db_session)
    db_session.flush()

    response = sign_in(loader_client, saman.id, pin="0000")

    assert response.status_code == 401
    assert response.json()["detail"] == {"code": "AUTHORIZATION_FAILED", "message": "Incorrect PIN."}
    assert db_session.query(LoaderSession).count() == 0


def test_an_unknown_or_inactive_loader_looks_like_a_wrong_pin(loader_client, db_session):
    register_tablet(db_session, make_dock(db_session))
    retired = make_loader(db_session, "Retired Loader", "Retired L.")
    retired.is_active = False
    db_session.flush()

    for user_id in (retired.id, 9999):
        response = sign_in(loader_client, user_id)
        assert response.status_code == 401
        assert response.json()["detail"]["message"] == "Incorrect PIN."


def test_an_unregistered_or_retired_tablet_is_a_404(loader_client, db_session):
    dock = make_dock(db_session)
    register_tablet(db_session, dock, label="Old tablet", active=False)
    saman = make_loader(db_session)
    db_session.flush()

    for label in ("Dock tablet 9", "Old tablet"):
        response = sign_in(loader_client, saman.id, tablet=label)
        assert response.status_code == 404
        assert response.json()["detail"]["entity"] == "DockTablet"


def test_signing_in_does_not_end_other_sessions_on_the_tablet(loader_client, db_session):
    register_tablet(db_session, make_dock(db_session))
    saman = make_loader(db_session)
    nimal = make_loader(db_session, "Nimal Senanayake", "Nimal S.")
    db_session.flush()

    first = sign_in(loader_client, saman.id).json()
    second = sign_in(loader_client, nimal.id).json()

    assert first["session_id"] != second["session_id"]
    assert db_session.get(LoaderSession, first["session_id"]).ended_at is None


# --- DELETE /loader/session/{id} -------------------------------------------------


def test_ending_a_session_records_when_and_why(loader_client, db_session):
    register_tablet(db_session, make_dock(db_session))
    saman = make_loader(db_session)
    db_session.flush()
    session_id = sign_in(loader_client, saman.id).json()["session_id"]

    response = end(loader_client, session_id, "switch_user")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["end_reason"] == "switch_user"
    assert body["ended_at"].endswith("Z")
    stored = db_session.get(LoaderSession, session_id)
    assert stored.end_reason == SessionEndReason.SWITCH_USER


def test_ending_twice_keeps_the_first_end(loader_client, db_session):
    """Offline sign-outs are replayed; the replay must not rewrite the end."""
    register_tablet(db_session, make_dock(db_session))
    saman = make_loader(db_session)
    db_session.flush()
    session_id = sign_in(loader_client, saman.id).json()["session_id"]

    first = end(loader_client, session_id, "idle_timeout").json()
    again = end(loader_client, session_id, "sign_out")

    assert again.status_code == 200
    assert again.json()["end_reason"] == "idle_timeout"
    assert again.json()["ended_at"] == first["ended_at"]


def test_ending_an_unknown_session_is_a_404(loader_client, db_session):
    response = end(loader_client, 4242)

    assert response.status_code == 404
    assert response.json()["detail"]["entity"] == "LoaderSession"


def test_an_unknown_end_reason_is_a_422(loader_client, db_session):
    response = end(loader_client, 1, "lunch")

    assert response.status_code == 422


# --- the session on the tablet's writes ---------------------------------------------


def test_a_check_is_stamped_with_the_signed_in_loader(loader_client, db_session):
    run, _ = build_run_021(db_session)
    register_tablet(db_session, run.dock)
    nimal = make_loader(db_session, "Nimal Senanayake", "Nimal S.")
    db_session.flush()
    session_id = sign_in(loader_client, nimal.id).json()["session_id"]
    action_id = str(uuid.uuid4())

    response = loader_client.post(
        f"{BASE}/runs/RUN-021/orders/ORD0092302/check",
        json={"client_action_id": action_id, "plan_version": 2, "loader_session_id": session_id},
    )

    assert response.status_code == 200, response.text
    row = next(o for s in response.json()["stops"] for o in s["orders"] if o["order_number"] == "ORD0092302")
    assert row["checked_by"] == "Nimal S."
    [check] = db_session.execute(select(LoadingCheck).filter_by(client_action_id=action_id)).scalars().all()
    assert check.actor_id == nimal.id


def test_a_write_replayed_after_sign_out_still_lands(loader_client, db_session):
    """An offline tap is often sent after the idle timeout has ended the session."""
    run, _ = build_run_021(db_session)
    register_tablet(db_session, run.dock)
    nimal = make_loader(db_session, "Nimal Senanayake", "Nimal S.")
    db_session.flush()
    session_id = sign_in(loader_client, nimal.id).json()["session_id"]
    end(loader_client, session_id, "idle_timeout")

    response = loader_client.post(
        f"{BASE}/runs/RUN-021/orders/ORD0092302/check",
        json={"client_action_id": str(uuid.uuid4()), "plan_version": 2, "loader_session_id": session_id},
    )

    assert response.status_code == 200, response.text
    row = next(o for s in response.json()["stops"] for o in s["orders"] if o["order_number"] == "ORD0092302")
    assert row["checked_by"] == "Nimal S."
