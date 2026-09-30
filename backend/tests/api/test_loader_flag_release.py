"""L5 POST /loader/issues, GET /loader/issues; L6 POST …/release and …/release/undo."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models.delivery_run import RunOrderState, RunStatus, RunStop, RunStopOrder
from app.models.loader_activity import LoaderActivity, ReleaseAction, RunReleaseAction
from app.models.loader_issue import LoaderIssue
from app.models.loader_user import LoaderSession
from app.models.reference import DockTablet
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    build_run_021,
    loader_client,
    make_loader,
)

BASE = "/api/v1/loader"
RUN = "RUN-021"


def signed_in(db, run, loader=None):
    """A session for Saman J. on the run's dock tablet."""
    loader = loader or make_loader(db)
    tablet = DockTablet(label=f"Tablet {uuid.uuid4().hex[:6]}", dock_id=run.dock_id)
    db.add(tablet)
    db.flush()
    session = LoaderSession(loader_user_id=loader.id, dock_tablet_id=tablet.id)
    db.add(session)
    db.flush()
    return session


def write(session_id=None, action_id=None, plan_version=2, **extra):
    return {
        "client_action_id": action_id or str(uuid.uuid4()),
        "plan_version": plan_version,
        "loader_session_id": session_id,
        **extra,
    }


def flag(client, session_id, order="ORD0092302", issue_type="damaged", units=3, **kw):
    return client.post(
        f"{BASE}/issues",
        json=write(session_id, run_code=RUN, order_number=order, issue_type=issue_type,
                   units_affected=units, quick_note_tag="Crushed carton", note="", **kw),
    )


def release(client, session_id, undo=False, **kw):
    return client.post(f"{BASE}/runs/{RUN}/release{'/undo' if undo else ''}", json=write(session_id, **kw))


def all_loaded(db, run):
    """Every order on the current plan checked, so nothing blocks release."""
    rows = db.execute(
        select(RunStopOrder).join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
        .where(RunStop.run_id == run.id, RunStop.plan_version == run.current_plan_version)
    ).scalars().all()
    for row in rows:
        row.state = RunOrderState.LOADED
    run.status = RunStatus.LOADED
    db.flush()


def logged(db, run, event_type):
    return db.execute(select(LoaderActivity).filter_by(run_id=run.id, event_type=event_type)).scalars().all()


# --- L5 flag ---------------------------------------------------------------------------


def test_a_flag_is_filed_locks_release_and_is_listed(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = signed_in(db_session, run)

    response = flag(loader_client, session.id)

    assert response.status_code == 200, response.text
    issue = response.json()
    assert (issue["run_code"], issue["order_number"], issue["outlet_code"]) == (RUN, "ORD0092302", "OUT026")
    assert (issue["issue_type"], issue["units_affected"], issue["units_total"]) == ("damaged", 3, 46)
    assert (issue["status"], issue["reported_by"], issue["quick_note_tag"]) == ("sent", "Saman J.", "Crushed carton")
    assert issue["note"] is None
    assert issue["decide_by"] == "2026-05-28T03:10:00Z"  # departs 03:30 minus 20 min
    assert [(o["label"], o["is_default"]) for o in issue["options"]] == [
        ("Send 43 of 46", True), ("Hold the vehicle", False),
    ]

    detail = loader_client.get(f"{BASE}/runs/{RUN}").json()
    row = next(o for s in detail["stops"] for o in s["orders"] if o["order_number"] == "ORD0092302")
    assert row["state"] == "flagged"
    assert detail["status"] == "issue_flagged"
    assert {"code": "issue_waiting", "count": 1} in detail["release_blockers"]
    assert detail["release_locked"] is True

    [entry] = logged(db_session, run, "issue_flagged")
    assert entry.message == "ORD0092302: damaged 3 of 46 units, sent to Dispatcher"
    newest = loader_client.get(f"{BASE}/runs/{RUN}/activity").json()[0]
    assert (newest["type"], newest["summary"]) == ("issue_flagged", entry.message)

    listed = loader_client.get(f"{BASE}/issues", params={"dock": "3"}).json()
    assert [i["id"] for i in listed] == [issue["id"]]
    assert loader_client.get(f"{BASE}/issues", params={"dock": "3", "run": RUN}).json() == listed


def test_the_issue_list_is_newest_first_and_needs_a_known_dock(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = signed_in(db_session, run)
    first = flag(loader_client, session.id, order="ORD0092302").json()
    second = flag(loader_client, session.id, order="ORD0092301", issue_type="missing", units=56).json()

    listed = loader_client.get(f"{BASE}/issues", params={"dock": "Dock 3"}).json()

    assert [i["id"] for i in listed] == [second["id"], first["id"]]
    assert loader_client.get(f"{BASE}/issues").status_code == 422
    assert loader_client.get(f"{BASE}/issues", params={"dock": "9"}).status_code == 404
    assert loader_client.get(f"{BASE}/issues", params={"dock": "3", "run": "RUN-999"}).status_code == 404


def test_a_flag_needs_a_session_and_a_sane_unit_count(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = signed_in(db_session, run)

    no_session = flag(loader_client, None)
    too_many = flag(loader_client, session.id, units=47)

    assert no_session.status_code == 422
    assert too_many.status_code == 422
    assert too_many.json()["detail"]["code"] == "INVALID_FLAG"
    assert db_session.query(LoaderIssue).count() == 0


def test_a_replayed_flag_files_one_issue(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = signed_in(db_session, run)
    action_id = str(uuid.uuid4())

    first = flag(loader_client, session.id, action_id=action_id)
    again = flag(loader_client, session.id, action_id=action_id)
    reused = flag(loader_client, session.id, action_id=action_id, order="ORD0092301")

    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert db_session.query(LoaderIssue).count() == 1
    assert len(logged(db_session, run, "issue_flagged")) == 1
    assert reused.status_code == 409
    assert reused.json()["detail"]["code"] == "CLIENT_ACTION_ID_REUSED"


# --- L6 release and undo ------------------------------------------------------------------


def test_release_is_locked_while_orders_are_open(loader_client, db_session):
    run, _ = build_run_021(db_session)  # 5 of 8 checked
    session = signed_in(db_session, run)

    response = release(loader_client, session.id)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "RELEASE_LOCKED"
    assert {"code": "orders_open", "count": 3} in detail["release_blockers"]
    assert db_session.query(RunReleaseAction).count() == 0
    assert run.status == RunStatus.LOADING


def test_release_marks_the_run_ready_three_ways(loader_client, db_session):
    run, _ = build_run_021(db_session)
    all_loaded(db_session, run)
    session = signed_in(db_session, run)

    response = release(loader_client, session.id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready_to_depart"
    assert body["released_by"]["name"] == "Saman J."
    assert body["released_at"].endswith("Z")
    [action] = db_session.execute(select(RunReleaseAction)).scalars().all()
    assert (action.action, action.actor_id) == (ReleaseAction.RELEASE, session.loader_user_id)
    [entry] = logged(db_session, run, "run_released")
    assert entry.message == "Ready to depart · Saman Jayawardena"
    newest = loader_client.get(f"{BASE}/runs/{RUN}/activity").json()[0]
    assert newest["summary"] == "Ready to depart · Saman J."


def test_a_replayed_release_and_a_second_release_change_nothing(loader_client, db_session):
    run, _ = build_run_021(db_session)
    all_loaded(db_session, run)
    session = signed_in(db_session, run)
    action_id = str(uuid.uuid4())

    first = release(loader_client, session.id, action_id=action_id)
    replay = release(loader_client, session.id, action_id=action_id)
    second_tap = release(loader_client, session.id)
    as_undo = release(loader_client, session.id, undo=True, action_id=action_id)

    assert (first.status_code, replay.status_code, second_tap.status_code) == (200, 200, 200)
    assert replay.json()["released_at"] == first.json()["released_at"]
    assert db_session.query(RunReleaseAction).count() == 1
    assert len(logged(db_session, run, "run_released")) == 1
    assert as_undo.status_code == 409
    assert as_undo.json()["detail"]["code"] == "CLIENT_ACTION_ID_REUSED"


def test_undo_within_the_window_puts_the_run_back_to_loaded(loader_client, db_session):
    run, _ = build_run_021(db_session)
    all_loaded(db_session, run)
    session = signed_in(db_session, run)
    release(loader_client, session.id)

    response = release(loader_client, session.id, undo=True)

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["status"], body["released_at"], body["released_by"]) == ("loaded", None, None)
    assert run.released_at is None and run.released_by_id is None
    actions = [a.action for a in db_session.execute(select(RunReleaseAction).order_by(RunReleaseAction.id)).scalars()]
    assert actions == [ReleaseAction.RELEASE, ReleaseAction.UNDO]
    [entry] = logged(db_session, run, "run_release_undone")
    assert entry.message == "Ready undone · Saman Jayawardena"
    newest = loader_client.get(f"{BASE}/runs/{RUN}/activity").json()[0]
    assert newest["summary"] == "Ready undone · Saman J."


def test_undo_after_the_window_is_refused(loader_client, db_session):
    run, _ = build_run_021(db_session)
    all_loaded(db_session, run)
    session = signed_in(db_session, run)
    release(loader_client, session.id)
    run.released_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=13)
    db_session.flush()

    response = release(loader_client, session.id, undo=True)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert (detail["code"], detail["window_seconds"]) == ("UNDO_WINDOW_EXPIRED", 10)
    assert run.status == RunStatus.READY_TO_DEPART
    assert logged(db_session, run, "run_release_undone") == []


def test_a_release_on_an_old_plan_is_stale(loader_client, db_session):
    run, _ = build_run_021(db_session)
    all_loaded(db_session, run)
    session = signed_in(db_session, run)

    response = release(loader_client, session.id, plan_version=1)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PLAN_VERSION_STALE"
