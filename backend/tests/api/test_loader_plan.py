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
    make_issue,
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


# --- row writes wait for the acknowledgement ---------------------------------


def row_write(client, verb, number, action_id=None, plan_version=3):
    method = "DELETE" if verb == "uncheck" else "POST"
    path = "check" if verb == "uncheck" else verb
    return client.request(
        method,
        f"{BASE}/runs/{RUN}/orders/{number}/{path}",
        json={"client_action_id": action_id or str(uuid.uuid4()), "plan_version": plan_version},
    )


def test_every_row_write_waits_for_the_acknowledgement(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    # The acknowledgement is checked before the row's own state.
    for verb, number in [
        ("check", "ORD0092302"),
        ("uncheck", "ORD0092301"),
        ("recheck", "ORD0092303"),
        ("unload", "ORD0092308"),
    ]:
        response = row_write(loader_client, verb, number)
        assert response.status_code == 409, (verb, response.text)
        detail = response.json()["detail"]
        assert detail["code"] == "PLAN_NOT_ACKNOWLEDGED", verb
        assert detail["unacknowledged_plan_version"] == 3


def test_row_writes_work_again_once_acknowledged(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)
    assert row_write(loader_client, "check", "ORD0092302").status_code == 409

    acknowledge(loader_client, 3)

    assert row_write(loader_client, "check", "ORD0092302").status_code == 200


def test_a_refused_write_changes_nothing(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    row_write(loader_client, "unload", "ORD0092308")

    assert row_for(db_session, run, "ORD0092308").state == RunOrderState.TAKE_OFF
    assert activity(db_session, run, "order_unloaded") == []


def test_a_replay_is_still_200_while_a_newer_plan_waits(loader_client, db_session):
    """Accepted on acknowledged v3, replayed after v4 lands unread: already done."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)
    action_id = str(uuid.uuid4())
    assert row_write(loader_client, "check", "ORD0092302", action_id=action_id).status_code == 200
    publish(db_session, run, dont_load_order_numbers=["ORD0092319"])

    replay = row_write(loader_client, "check", "ORD0092302", action_id=action_id)

    assert replay.status_code == 200, replay.text
    assert replay.json()["unacknowledged_plan_version"] == 4


def test_a_stale_write_is_stale_before_it_is_unacknowledged(loader_client, db_session):
    """A v2 tap after v3 lands says the plan changed, the more useful answer."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    response = row_write(loader_client, "check", "ORD0092302", plan_version=2)

    assert response.json()["detail"]["code"] == "PLAN_VERSION_STALE"


# --- the diff on GET /loader/runs/{code} -------------------------------------


def run_body(client):
    return client.get(f"{BASE}/runs/{RUN}").json()


def stop_in(body, outlet_code):
    return next(s for s in body["stops"] if s["outlet"]["code"] == outlet_code)


def order_of(body, number):
    return next(o for s in body["stops"] for o in s["orders"] if o["order_number"] == number)


def test_a_run_with_no_earlier_plan_has_no_diff(loader_client, db_session):
    """RUN-021 is seeded straight at v2, so there is nothing to compare with."""
    build_run_021(db_session)
    db_session.flush()

    body = run_body(loader_client)

    assert body["plan_change"] is None
    assert body["acknowledged_plan_version"] == 2
    assert all(s["note"] is None and s["is_new"] is False for s in body["stops"])
    assert all(o["change_kind"] is None and o["note"] is None for s in body["stops"] for o in s["orders"])


def test_the_diff_summarises_the_change(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    change = run_body(loader_client)["plan_change"]

    assert (change["from_version"], change["to_version"]) == (2, 3)
    assert (change["planned_weight_before_kg"], change["planned_weight_after_kg"]) == (4920.0, 4690.0)
    assert (change["planned_volume_before_m3"], change["planned_volume_after_m3"]) == (23.9, 22.6)
    # Six orders were aboard at v2 (the fixture's five plus ORD0092308).
    assert change["checks_saved"] == 6
    assert change["was_ready_at"] is None
    assert change["published_at"].endswith("Z")


def test_each_order_is_in_its_diff_group(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    body = run_body(loader_client)

    take_off = order_of(body, "ORD0092308")
    assert (take_off["change_kind"], take_off["changed_in_version"]) == ("unload_from_truck", 3)
    assert take_off["note"] == "Take off the truck"
    dont_load = order_of(body, "ORD0092304")
    assert (dont_load["change_kind"], dont_load["changed_in_version"]) == ("dont_load", 3)
    assert dont_load["moved_to"] is None and dont_load["deferred_to"] is None
    new = order_of(body, "ORD0092319")
    assert (new["change_kind"], new["changed_in_version"]) == ("load_new", 3)
    # Left alone by the dispatcher.
    untouched = order_of(body, "ORD0092302")
    assert (untouched["change_kind"], untouched["changed_in_version"], untouched["note"]) == (None, None, None)


def test_a_re_check_row_says_what_it_was_moved_to_reach(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    body = run_body(loader_client)

    # OUT031 loads 2nd, in front of ORD0092308 at OUT027 (1st, deepest).
    moved = order_of(body, "ORD0092305")
    assert moved["state"] == "re_check"
    assert moved["note"] == "Re-check · moved to reach ORD0092308"
    assert (moved["change_kind"], moved["changed_in_version"]) == (None, 3)
    # Same stop as the order coming off: nothing had to move to reach it.
    assert order_of(body, "ORD0092307")["note"] == "Re-check · plan changed"


def test_stops_say_how_they_moved(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    body = run_body(loader_client)

    assert (stop_in(body, "OUT028")["note"], stop_in(body, "OUT028")["is_new"]) == ("new stop", True)
    assert stop_in(body, "OUT027")["note"] == "was Stop 4"
    assert stop_in(body, "OUT026")["note"] == "was Stop 1"
    assert stop_in(body, "OUT027")["is_new"] is False


def test_an_unloaded_order_stays_in_the_unload_group(loader_client, db_session):
    run, _ = build_run_021(db_session)
    session = open_session(db_session, run, make_loader(db_session))
    figma_v3(db_session, run)

    loader_client.post(
        f"{BASE}/runs/{RUN}/orders/ORD0092308/unload",
        json={"client_action_id": str(uuid.uuid4()), "plan_version": 3, "loader_session_id": session.id},
    )
    order = order_of(run_body(loader_client), "ORD0092308")

    assert order["state"] == "moved"
    assert order["change_kind"] == "unload_from_truck"
    assert order["note"] == "Off truck · back in chiller"
    assert order["unloaded_at"].endswith("Z")
    assert order["unloaded_by"] == "Saman J."


def test_a_rechecked_order_remembers_the_version(loader_client, db_session):
    """The frontend shows "Re-checked 02:26" rather than "Loaded" for it."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    loader_client.post(
        f"{BASE}/runs/{RUN}/orders/ORD0092305/recheck",
        json={"client_action_id": str(uuid.uuid4()), "plan_version": 3},
    )
    order = order_of(run_body(loader_client), "ORD0092305")

    assert order["state"] == "loaded"
    assert (order["changed_in_version"], order["change_kind"], order["note"]) == (3, None, None)


def test_the_diff_stays_after_the_acknowledgement(loader_client, db_session):
    """The updated checklist (T2b) keeps "was Stop 4" and the take-off note."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    body = run_body(loader_client)

    assert body["unacknowledged_plan_version"] is None
    assert body["acknowledged_plan_version"] == 3
    assert (body["plan_change"]["from_version"], body["plan_change"]["to_version"]) == (2, 3)
    assert stop_in(body, "OUT027")["note"] == "was Stop 4"


def test_stacked_changes_read_as_one_diff(loader_client, db_session):
    """v3 and v4 both unread: one diff from v2, with v3's add-then-drop gone."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)
    publish(db_session, run, dont_load_order_numbers=["ORD0092319"])

    body = run_body(loader_client)

    assert (body["plan_change"]["from_version"], body["plan_change"]["to_version"]) == (2, 4)
    assert body["unacknowledged_plan_version"] == 4
    assert body["acknowledged_plan_version"] == 2
    # Added in v3 and dropped in v4, never loaded: not part of the diff.
    assert order_of(body, "ORD0092319")["change_kind"] is None
    # v3's take-off is still outstanding and still says so.
    take_off = order_of(body, "ORD0092308")
    assert (take_off["state"], take_off["change_kind"], take_off["changed_in_version"]) == (
        "take_off", "unload_from_truck", 3,
    )
    # Checks are never lost across the two versions.
    assert body["plan_change"]["checks_saved"] == 6


def test_a_change_after_an_acknowledgement_starts_a_new_diff(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)
    publish(db_session, run, dont_load_order_numbers=["ORD0092302"])

    body = run_body(loader_client)

    assert (body["plan_change"]["from_version"], body["plan_change"]["to_version"]) == (3, 4)
    assert order_of(body, "ORD0092302")["change_kind"] == "dont_load"
    # v3's changes were read already; OUT028 is no longer new against v3.
    assert order_of(body, "ORD0092319")["change_kind"] is None
    assert stop_in(body, "OUT028")["note"] is None


def test_a_reopened_run_says_when_it_was_ready(loader_client, db_session):
    run, _ = build_run_021(db_session)
    run.status = RunStatus.READY_TO_DEPART
    run.released_at = at("01:48")
    publish(db_session, run, load_new_order_numbers=["ORD0092319"])

    body = run_body(loader_client)

    assert body["status"] == "loading"
    assert body["plan_change"]["was_ready_at"] == "2026-05-28T01:48:00Z"


# --- release lock --------------------------------------------------------------


def blockers(body):
    return {b["code"]: b["count"] for b in body["release_blockers"]}


def check_every_open_order(db, run):
    for stop in LoaderService.current_stops(db, run):
        for row in stop.orders:
            if row.state in (RunOrderState.TO_LOAD, RunOrderState.NEW, RunOrderState.RE_CHECK):
                row.state = RunOrderState.LOADED
    db.flush()


def test_a_fully_loaded_run_can_be_released(loader_client, db_session):
    run, _ = build_run_021(db_session)
    check_every_open_order(db_session, run)

    body = run_body(loader_client)

    assert body["release_locked"] is False
    assert body["release_blockers"] == []


def test_open_orders_lock_release(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    body = run_body(loader_client)

    assert body["release_locked"] is True
    assert blockers(body) == {"orders_open": 3}


def test_an_unread_plan_locks_release(loader_client, db_session):
    """Figma 2c #2: "Acknowledge plan v3 first"."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run, acknowledged=False)

    body = run_body(loader_client)

    assert blockers(body)["plan_not_acknowledged"] == 1
    assert [b["code"] for b in body["release_blockers"]][0] == "plan_not_acknowledged"


def test_each_plan_change_task_locks_release(loader_client, db_session):
    """T2b footer: unload first, then re-checks and the orders still to load."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    body = run_body(loader_client)

    assert blockers(body) == {
        "unload_pending": 1,  # ORD0092308
        "re_check_pending": 5,  # aboard at v2, apart from the one coming off
        "orders_open": 2,  # ORD0092302 and the new ORD0092319
    }
    assert [b["code"] for b in body["release_blockers"]] == [
        "unload_pending", "re_check_pending", "orders_open",
    ]


def test_an_outstanding_unload_locks_release_even_when_all_is_checked(loader_client, db_session):
    """take_off is outside orders_total, so "all checked" alone is not enough."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)
    check_every_open_order(db_session, run)

    body = run_body(loader_client)

    assert body["orders_checked"] == body["orders_total"]
    assert blockers(body) == {"unload_pending": 1}

    unload(loader_client, "ORD0092308")
    assert run_body(loader_client)["release_locked"] is False


def test_a_waiting_issue_locks_release(loader_client, db_session):
    run, orders = build_run_021(db_session)
    check_every_open_order(db_session, run)
    make_issue(db_session, run, orders["ORD0092302"], make_loader(db_session, "Tharindu J", "Tharindu J."))

    body = run_body(loader_client)

    assert blockers(body) == {"issue_waiting": 1}


def test_a_check_on_a_re_check_row_also_remembers_the_version(loader_client, db_session):
    """The tablet sends check, not recheck; the row still reads "Re-checked"."""
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    loader_client.post(
        f"{BASE}/runs/{RUN}/orders/ORD0092305/check",
        json={"client_action_id": str(uuid.uuid4()), "plan_version": 3},
    )
    body = run_body(loader_client)

    assert order_of(body, "ORD0092305")["state"] == "loaded"
    assert order_of(body, "ORD0092305")["changed_in_version"] == 3


def test_checking_a_new_order_is_not_a_re_check(loader_client, db_session):
    run, _ = build_run_021(db_session)
    figma_v3(db_session, run)

    loader_client.post(
        f"{BASE}/runs/{RUN}/orders/ORD0092319/check",
        json={"client_action_id": str(uuid.uuid4()), "plan_version": 3},
    )
    new = order_of(run_body(loader_client), "ORD0092319")

    # Still shown as added by v3, not as re-checked.
    assert (new["state"], new["change_kind"], new["changed_in_version"]) == ("loaded", "load_new", 3)
