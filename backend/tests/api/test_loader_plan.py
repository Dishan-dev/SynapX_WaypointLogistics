"""L7 writes and reads: acknowledge a plan change, unload, the diff, release lock."""
import uuid

from sqlalchemy import select

from app.models.delivery_run import RunOrderState, RunStatus, RunStop, RunStopOrder
from app.models.loader_activity import CheckAction, LoaderActivity, LoadingCheck
from app.models.loader_user import LoaderSession
from app.models.order import Order
from app.models.plan_revision import PlanRevision
from app.models.reference import DockTablet
from app.schemas.loader import AcknowledgePlanRequest, SimulatedPlanChangeRequest
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    at,
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


def row_for(db, run, number):
    return db.execute(
        select(RunStopOrder)
        .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
        .join(Order, RunStopOrder.order_id == Order.id)
        .where(
            RunStop.run_id == run.id,
            RunStop.plan_version == run.current_plan_version,
            Order.order_number == number,
        )
    ).scalars().one()


def put_on_truck(db, run, number):
    """Load an order at v2 without going through the API.

    The fixture (like the seed) has ORD0092308 still in staging at v2, while
    the design has it loaded deepest when v3 asks for it back.
    """
    row = row_for(db, run, number)
    row.state = RunOrderState.LOADED
    row.checked_at = at("02:12")
    LoaderService.recalculate_capacity(db, run)
    db.flush()


def figma_v3(db, run, acknowledged=True):
    """The design's v2 -> v3 change, with ORD0092308 aboard first."""
    put_on_truck(db, run, "ORD0092308")
    publish(
        db, run,
        unload_order_numbers=["ORD0092308"],
        dont_load_order_numbers=["ORD0092304"],
        load_new_order_numbers=["ORD0092319"],
    )
    if acknowledged:
        LoaderService.acknowledge_plan(
            db, RUN, 3,
            AcknowledgePlanRequest(client_action_id=uuid.uuid4(), plan_version=3),
        )
        db.flush()


def unload(client, number, action_id=None, plan_version=3):
    return client.post(
        f"{BASE}/runs/{RUN}/orders/{number}/unload",
        json={"client_action_id": action_id or str(uuid.uuid4()), "plan_version": plan_version},
    )


def order_in(response, number):
    for stop in response.json()["stops"]:
        for order in stop["orders"]:
            if order["order_number"] == number:
                return order
    raise AssertionError(f"{number} not in response")


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


# --- unload ------------------------------------------------------------------


def test_unload_takes_the_order_off_the_run(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = open_session(db_session, run, make_loader(db_session))
    figma_v3(db_session, run)

    response = loader_client.post(
        f"{BASE}/runs/{RUN}/orders/ORD0092308/unload",
        json={
            "client_action_id": str(uuid.uuid4()),
            "plan_version": 3,
            "loader_session_id": session.id,
        },
    )

    assert response.status_code == 200, response.text
    assert order_in(response, "ORD0092308")["state"] == "moved"
    [check] = db_session.execute(
        select(LoadingCheck).filter_by(action=CheckAction.UNLOAD)
    ).scalars().all()
    assert check.actor_id == session.loader_user_id
    assert check.plan_version == 3
    [entry] = activity(db_session, run, "order_unloaded")
    assert entry.message == "ORD0092308 off truck, back in chiller"


def test_an_ambient_order_goes_back_to_staging(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish(db_session, run, unload_order_numbers=["ORD0092307"])
    acknowledge(loader_client, 3)

    assert unload(loader_client, "ORD0092307").status_code == 200

    [entry] = activity(db_session, run, "order_unloaded")
    assert entry.message == "ORD0092307 off truck, back in staging"


def test_unload_keeps_the_stop_and_the_totals_right(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)
    before = loader_client.get(f"{BASE}/runs/{RUN}").json()

    after = unload(loader_client, "ORD0092308").json()

    # An order being taken off was already out of the plan and the counts.
    assert after["orders_total"] == before["orders_total"]
    assert after["capacity"] == before["capacity"]
    out027 = next(s for s in after["stops"] if s["outlet"]["code"] == "OUT027")
    assert [o["state"] for o in out027["orders"]] == ["re_check", "moved"]


def test_an_unload_replay_returns_200_and_applies_once(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)
    action_id = str(uuid.uuid4())

    first = unload(loader_client, "ORD0092308", action_id=action_id)
    replay = unload(loader_client, "ORD0092308", action_id=action_id)

    assert (first.status_code, replay.status_code) == (200, 200)
    assert len(activity(db_session, run, "order_unloaded")) == 1


def test_unloading_an_unloaded_order_is_a_quiet_no_op(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)
    unload(loader_client, "ORD0092308")

    second = unload(loader_client, "ORD0092308")

    assert second.status_code == 200, second.text
    assert len(activity(db_session, run, "order_unloaded")) == 1


def test_unload_refuses_an_order_the_plan_did_not_take_off(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    response = unload(loader_client, "ORD0092302")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "INVALID_STATE_TRANSITION"
    assert (detail["current_state"], detail["target_state"]) == ("to_load", "moved")


def test_an_unload_against_an_old_plan_is_409(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    response = unload(loader_client, "ORD0092308", plan_version=2)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PLAN_VERSION_STALE"
    assert row_for(db_session, run, "ORD0092308").state == RunOrderState.TAKE_OFF
