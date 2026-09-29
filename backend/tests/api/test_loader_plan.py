"""L7 writes and reads: acknowledge a plan change, unload, the diff, release lock."""
import uuid

from sqlalchemy import select

from app.models.delivery_run import RunStatus
from app.models.loader_activity import LoaderActivity
from app.models.loader_user import LoaderSession
from app.models.plan_revision import PlanRevision
from app.models.reference import DockTablet
from app.schemas.loader import SimulatedPlanChangeRequest
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    build_run_021,
    loader_client,
    make_loader,
)

BASE = "/api/v1/loader"
RUN = "RUN-021"


def publish(db, run, **changes):
    LoaderService.simulate_plan_change(db, run, SimulatedPlanChangeRequest(**changes))
    db.flush()


def open_session(db, run, loader):
    tablet = DockTablet(label="Dock tablet 3", dock_id=run.dock_id)
    db.add(tablet)
    db.flush()
    session = LoaderSession(loader_user_id=loader.id, dock_tablet_id=tablet.id)
    db.add(session)
    db.flush()
    return session


def acknowledge(client, version, action_id=None, plan_version=None, **extra):
    return client.post(
        f"{BASE}/runs/{RUN}/plan/{version}/acknowledge",
        json={
            "client_action_id": action_id or str(uuid.uuid4()),
            "plan_version": version if plan_version is None else plan_version,
            **extra,
        },
    )


def revision(db, run, version):
    return db.execute(
        select(PlanRevision).filter_by(run_id=run.id, version=version)
    ).scalars().one()


def activity(db, run, event_type):
    return db.execute(
        select(LoaderActivity).filter_by(run_id=run.id, event_type=event_type)
    ).scalars().all()


# --- acknowledge -------------------------------------------------------------


def test_acknowledge_unblocks_the_checklist(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = open_session(db_session, run, make_loader(db_session))
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])

    response = acknowledge(loader_client, 3, loader_session_id=session.id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["unacknowledged_plan_version"] is None
    assert body["plan"]["acknowledged_by"] == "Saman J."
    assert body["plan"]["acknowledged_at"].endswith("Z")
    [entry] = activity(db_session, run, "plan_acknowledged")
    assert entry.message == "Plan v3 received · Saman Jayawardena"


def test_acknowledge_without_a_session_records_an_unknown_loader(loader_client, db_session):
    """Optional until L2 sign-in lands; then it becomes required."""
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])

    response = acknowledge(loader_client, 3)

    assert response.status_code == 200, response.text
    assert response.json()["plan"]["acknowledged_by"] is None
    assert revision(db_session, run, 3).acknowledged_at is not None
    [entry] = activity(db_session, run, "plan_acknowledged")
    assert entry.message == "Plan v3 received · unknown loader"


def test_an_acknowledge_replay_returns_200_and_logs_once(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    action_id = str(uuid.uuid4())

    first = acknowledge(loader_client, 3, action_id=action_id)
    replay = acknowledge(loader_client, 3, action_id=action_id)

    assert (first.status_code, replay.status_code) == (200, 200)
    assert len(activity(db_session, run, "plan_acknowledged")) == 1


def test_an_acknowledge_replay_after_a_newer_plan_is_still_200(loader_client, db_session):
    """It already happened; a replay is never checked against the current plan."""
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    action_id = str(uuid.uuid4())
    acknowledge(loader_client, 3, action_id=action_id)
    publish(db_session, run, dont_load_order_numbers=["ORD0092302"])

    replay = acknowledge(loader_client, 3, action_id=action_id)

    assert replay.status_code == 200, replay.text
    assert replay.json()["unacknowledged_plan_version"] == 4


def test_reusing_an_acknowledge_id_for_another_version_is_409(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    action_id = str(uuid.uuid4())
    acknowledge(loader_client, 3, action_id=action_id)
    publish(db_session, run, dont_load_order_numbers=["ORD0092302"])

    response = acknowledge(loader_client, 4, action_id=action_id)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "CLIENT_ACTION_ID_REUSED"
    assert detail["entity"] == "PlanRevision"


def test_acknowledging_an_older_version_is_409_stale(loader_client, db_session):
    """v4 arrived while the v3 diff was open: the loader must read v2 -> v4."""
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    publish(db_session, run, dont_load_order_numbers=["ORD0092302"])

    response = acknowledge(loader_client, 3)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "PLAN_VERSION_STALE"
    assert (detail["current_plan_version"], detail["sent_plan_version"]) == (4, 3)
    assert revision(db_session, run, 3).acknowledged_at is None


def test_acknowledging_the_latest_confirms_stacked_changes_once(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = open_session(db_session, run, make_loader(db_session, "Nimal Perera", "Nimal P."))
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    publish(db_session, run, dont_load_order_numbers=["ORD0092302"])

    response = acknowledge(loader_client, 4, loader_session_id=session.id)

    assert response.status_code == 200, response.text
    v3, v4 = revision(db_session, run, 3), revision(db_session, run, 4)
    assert v3.acknowledged_at is not None and v4.acknowledged_at is not None
    assert v3.acknowledged_at == v4.acknowledged_at
    assert v3.acknowledged_by_id == v4.acknowledged_by_id == session.loader_user_id
    # The tap's id belongs to the version it named.
    assert v3.client_action_id is None and v4.client_action_id is not None
    [entry] = activity(db_session, run, "plan_acknowledged")
    assert entry.message == "Plan v4 received · Nimal Perera"


def test_a_body_version_that_differs_from_the_path_is_422(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])

    response = acknowledge(loader_client, 3, plan_version=2)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "PLAN_VERSION_MISMATCH"


def test_acknowledging_an_acknowledged_plan_is_a_quiet_no_op(loader_client, db_session):
    """Two tablets on the same run: the second loader's tap should not bounce."""
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    acknowledge(loader_client, 3)

    second = acknowledge(loader_client, 3)

    assert second.status_code == 200, second.text
    assert len(activity(db_session, run, "plan_acknowledged")) == 1


def test_acknowledge_is_refused_after_gate_out(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])
    run.status = RunStatus.GATED_OUT
    db_session.flush()

    response = acknowledge(loader_client, 3)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "INVALID_STATE_TRANSITION"


def test_acknowledge_requires_client_action_id(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])

    response = loader_client.post(
        f"{BASE}/runs/{RUN}/plan/3/acknowledge", json={"plan_version": 3}
    )

    assert response.status_code == 422
