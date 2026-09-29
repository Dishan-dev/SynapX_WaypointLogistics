"""L4 writes: check, uncheck and recheck on the loading checklist."""
import uuid

from sqlalchemy import select

from app.models.delivery_run import RunOrderState, RunStatus, RunStop, RunStopOrder, StopStatus
from app.models.loader_activity import CheckAction, LoaderActivity, LoadingCheck
from app.models.loader_user import LoaderSession
from app.models.order import Order
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


def order_url(number, verb="check", run=RUN):
    return f"{BASE}/runs/{run}/orders/{number}/{verb}"


def body(action_id=None, plan_version=2, **extra):
    return {"client_action_id": action_id or str(uuid.uuid4()), "plan_version": plan_version, **extra}


def check(client, number, **kw):
    return client.post(order_url(number), json=body(**kw))


def uncheck(client, number, **kw):
    # httpx's delete() takes no json=, so go through request().
    return client.request("DELETE", order_url(number), json=body(**kw))


def recheck(client, number, **kw):
    return client.post(order_url(number, "recheck"), json=body(**kw))


def order_state(response, number):
    for stop in response.json()["stops"]:
        for order in stop["orders"]:
            if order["order_number"] == number:
                return order
    raise AssertionError(f"{number} not in response")


def checks_for(db, action_id):
    return db.execute(
        select(LoadingCheck).filter_by(client_action_id=action_id)
    ).scalars().all()


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


def publish_v3(db, run, **changes):
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


# --- check -----------------------------------------------------------------


def test_check_loads_the_order_and_rolls_everything_up(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    # The outbox also sends run_code and order_number; they are ignored.
    response = loader_client.post(
        order_url("ORD0092302"),
        json=body(action_id, run_code=RUN, order_number="ORD0092302"),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert order_state(response, "ORD0092302")["state"] == "loaded"
    assert order_state(response, "ORD0092302")["checked_at"] is not None
    assert (data["orders_checked"], data["orders_total"]) == (6, 8)
    assert data["capacity"]["loaded_weight_kg"] == 3410.0 + 690.0
    assert data["status"] == "loading"

    [recorded] = checks_for(db_session, action_id)
    assert recorded.action == CheckAction.CHECK
    assert recorded.plan_version == 2
    [logged] = activity(db_session, run, "order_checked")
    assert logged.message == "ORD0092302 loaded"
    assert logged.order.order_number == "ORD0092302"


def test_check_stamps_the_signed_in_loader(loader_client, db_session):
    run, _ = build_run_021(db_session)
    tharindu = make_loader(db_session, "Tharindu Jayasinghe", "Tharindu J.")
    session = open_session(db_session, run, tharindu)

    response = check(loader_client, "ORD0092302", loader_session_id=session.id)

    assert response.status_code == 200, response.text
    assert order_state(response, "ORD0092302")["checked_by"] == "Tharindu J."


def test_check_accepts_an_ended_session(loader_client, db_session):
    """Offline taps are often replayed after the idle timeout signed them out."""
    run, _ = build_run_021(db_session)
    loader = make_loader(db_session, "Tharindu Jayasinghe", "Tharindu J.")
    session = open_session(db_session, run, loader)
    session.ended_at = session.started_at
    db_session.flush()

    response = check(loader_client, "ORD0092302", loader_session_id=session.id)

    assert response.status_code == 200, response.text


def test_check_without_a_session_leaves_checked_by_empty(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = check(loader_client, "ORD0092302")

    assert order_state(response, "ORD0092302")["checked_by"] is None


def test_first_check_moves_a_run_from_not_started_to_loading(loader_client, db_session):
    run, _ = build_run_021(db_session)
    run.status = RunStatus.NOT_STARTED
    db_session.flush()

    response = check(loader_client, "ORD0092302")

    assert response.json()["status"] == "loading"


def test_checking_the_last_order_marks_the_run_loaded(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()

    for number in ("ORD0092302", "ORD0092304", "ORD0092308"):
        response = check(loader_client, number)
        assert response.status_code == 200, response.text

    data = response.json()
    assert (data["orders_checked"], data["orders_total"]) == (8, 8)
    assert data["status"] == "loaded"
    # Each stop a check touched is now complete. (OUT031 was fully loaded before
    # the test and nothing wrote to it, so its fixture status is left alone.)
    touched = {"OUT026", "OUT030", "OUT027"}
    assert {s["status"] for s in data["stops"] if s["outlet"]["code"] in touched} == {
        StopStatus.COMPLETE.value
    }


def test_flagged_orders_count_toward_loaded(loader_client, db_session):
    run, _ = build_run_021(db_session)
    row_for(db_session, run, "ORD0092308").state = RunOrderState.FLAGGED
    db_session.flush()

    check(loader_client, "ORD0092302")
    response = check(loader_client, "ORD0092304")

    assert response.json()["status"] == "loaded"


def test_an_issue_flagged_run_stays_issue_flagged(loader_client, db_session):
    run, orders = build_run_021(db_session)
    run.status = RunStatus.ISSUE_FLAGGED
    db_session.flush()

    response = check(loader_client, "ORD0092302")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "issue_flagged"


def test_stop_status_follows_its_rows(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = check(loader_client, "ORD0092308")

    # OUT027 is load position 1: both its orders are now loaded.
    first = response.json()["stops"][0]
    assert first["outlet"]["code"] == "OUT027"
    assert first["status"] == "complete"


def test_checking_a_loaded_order_again_is_a_quiet_no_op(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    response = check(loader_client, "ORD0092301", action_id=action_id)

    assert response.status_code == 200, response.text
    assert checks_for(db_session, action_id) == []
    assert activity(db_session, run, "order_checked") == []


def test_check_refuses_a_flagged_order(loader_client, db_session):
    run, _ = build_run_021(db_session)
    row_for(db_session, run, "ORD0092302").state = RunOrderState.FLAGGED
    db_session.flush()

    response = check(loader_client, "ORD0092302")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "INVALID_STATE_TRANSITION"


def test_check_refuses_a_re_check_order_which_needs_recheck(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish_v3(db_session, run, unload_order_numbers=["ORD0092308"])

    response = check(loader_client, "ORD0092301", plan_version=3)

    assert response.status_code == 409
    assert response.json()["detail"]["current_state"] == "re_check"


def test_writes_are_refused_once_the_run_is_signed_off(loader_client, db_session):
    run, _ = build_run_021(db_session)
    for status in (RunStatus.READY_TO_DEPART, RunStatus.GATED_OUT):
        run.status = status
        db_session.flush()

        response = check(loader_client, "ORD0092302")

        assert response.status_code == 409, status
        assert response.json()["detail"]["code"] == "INVALID_STATE_TRANSITION"


# --- uncheck ---------------------------------------------------------------


def test_uncheck_returns_the_order_to_to_load(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()

    response = uncheck(loader_client, "ORD0092301")

    assert response.status_code == 200, response.text
    row = order_state(response, "ORD0092301")
    assert row["state"] == "to_load"
    assert row["checked_at"] is None and row["checked_by"] is None
    assert response.json()["orders_checked"] == 4
    assert response.json()["capacity"]["loaded_weight_kg"] == 3410.0 - 820.0
    [logged] = activity(db_session, run, "order_unchecked")
    assert logged.message == "ORD0092301 unchecked"


def test_uncheck_takes_a_loaded_run_back_to_loading(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()
    for number in ("ORD0092302", "ORD0092304", "ORD0092308"):
        check(loader_client, number)

    response = uncheck(loader_client, "ORD0092302")

    assert response.json()["status"] == "loading"


def test_unchecking_everything_never_returns_to_not_started(loader_client, db_session):
    run, _ = build_run_021(db_session)
    run.status = RunStatus.NOT_STARTED
    db_session.flush()

    check(loader_client, "ORD0092302")
    response = uncheck(loader_client, "ORD0092302")

    assert response.json()["status"] == "loading"


def test_uncheck_of_an_order_this_plan_added_returns_it_to_new(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish_v3(db_session, run, load_new_order_numbers=["ORD0092319"])

    assert check(loader_client, "ORD0092319", plan_version=3).status_code == 200
    response = uncheck(loader_client, "ORD0092319", plan_version=3)

    assert order_state(response, "ORD0092319")["state"] == "new"


def test_unchecking_an_unchecked_order_is_a_quiet_no_op(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    response = uncheck(loader_client, "ORD0092302", action_id=action_id)

    assert response.status_code == 200, response.text
    assert checks_for(db_session, action_id) == []


# --- recheck ---------------------------------------------------------------


def test_recheck_confirms_a_re_check_order(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish_v3(db_session, run, unload_order_numbers=["ORD0092308"])

    response = recheck(loader_client, "ORD0092301", plan_version=3)

    assert response.status_code == 200, response.text
    assert order_state(response, "ORD0092301")["state"] == "loaded"
    [logged] = activity(db_session, run, "order_rechecked")
    assert logged.message == "ORD0092301 re-checked"


def test_re_check_does_not_count_until_rechecked(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish_v3(db_session, run, unload_order_numbers=["ORD0092308"])

    before = loader_client.get(f"{BASE}/runs/{RUN}").json()["orders_checked"]
    after = recheck(loader_client, "ORD0092301", plan_version=3).json()["orders_checked"]

    assert after == before + 1


def test_recheck_refuses_an_order_that_is_not_re_check(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = recheck(loader_client, "ORD0092302")

    assert response.status_code == 409
    assert response.json()["detail"]["current_state"] == "to_load"


# --- client_action_id ------------------------------------------------------


def test_a_replay_returns_200_and_applies_nothing(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    first = check(loader_client, "ORD0092302", action_id=action_id)
    second = check(loader_client, "ORD0092302", action_id=action_id)

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert len(checks_for(db_session, action_id)) == 1
    assert len(activity(db_session, run, "order_checked")) == 1


def test_a_replay_returns_the_runs_current_state(loader_client, db_session):
    """Not a stored copy of the first response - the contract says so."""
    build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    check(loader_client, "ORD0092302", action_id=action_id)
    check(loader_client, "ORD0092304")
    replay = check(loader_client, "ORD0092302", action_id=action_id)

    assert replay.status_code == 200
    assert order_state(replay, "ORD0092304")["state"] == "loaded"


def test_a_replay_after_a_plan_change_is_still_200(loader_client, db_session):
    """Replay is checked before the stale-plan rule, or offline queues would 409."""
    run, _ = build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    assert check(loader_client, "ORD0092302", action_id=action_id).status_code == 200
    publish_v3(db_session, run, unload_order_numbers=["ORD0092308"])
    replay = check(loader_client, "ORD0092302", action_id=action_id, plan_version=2)

    assert replay.status_code == 200, replay.text
    assert len(checks_for(db_session, action_id)) == 1


def test_an_uncheck_replay_is_idempotent(loader_client, db_session):
    run, _ = build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    uncheck(loader_client, "ORD0092301", action_id=action_id)
    check(loader_client, "ORD0092301")
    replay = uncheck(loader_client, "ORD0092301", action_id=action_id)

    assert replay.status_code == 200
    # The later check stands; the replayed uncheck did not undo it.
    assert order_state(replay, "ORD0092301")["state"] == "loaded"


def test_reusing_an_id_for_another_order_is_409(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    check(loader_client, "ORD0092302", action_id=action_id)
    response = check(loader_client, "ORD0092304", action_id=action_id)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "CLIENT_ACTION_ID_REUSED"
    assert order_state(loader_client.get(f"{BASE}/runs/{RUN}"), "ORD0092304")["state"] == "to_load"


def test_reusing_an_id_for_another_action_is_409(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()
    action_id = str(uuid.uuid4())

    check(loader_client, "ORD0092302", action_id=action_id)
    response = uncheck(loader_client, "ORD0092302", action_id=action_id)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "CLIENT_ACTION_ID_REUSED"


def test_a_racing_replay_loses_on_the_unique_constraint(loader_client, db_session, monkeypatch):
    """Both copies pass the lookup; the second insert must not double-apply."""
    run, _ = build_run_021(db_session)
    action_id = str(uuid.uuid4())
    row = row_for(db_session, run, "ORD0092302")
    # The "other" request already committed this id, but not yet its state change
    # as far as our first lookup can tell.
    db_session.add(LoadingCheck(
        run_stop_order_id=row.id, action=CheckAction.CHECK,
        client_action_id=action_id, plan_version=2,
    ))
    db_session.flush()

    real_find = LoaderService._find_loading_check
    calls = {"n": 0}

    def blind_first_lookup(db, found_id):
        calls["n"] += 1
        return None if calls["n"] == 1 else real_find(db, found_id)

    monkeypatch.setattr(LoaderService, "_find_loading_check", staticmethod(blind_first_lookup))

    response = check(loader_client, "ORD0092302", action_id=action_id)

    assert response.status_code == 200, response.text
    assert len(checks_for(db_session, action_id)) == 1
    assert activity(db_session, run, "order_checked") == []


# --- stale plan ------------------------------------------------------------


def test_a_write_against_an_old_plan_version_is_409(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish_v3(db_session, run, unload_order_numbers=["ORD0092308"])

    response = check(loader_client, "ORD0092302", plan_version=2)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "PLAN_VERSION_STALE"
    assert (detail["current_plan_version"], detail["sent_plan_version"]) == (3, 2)
    assert "v3" in detail["message"]


def test_a_stale_write_changes_nothing(loader_client, db_session):
    run, _ = build_run_021(db_session)
    publish_v3(db_session, run, unload_order_numbers=["ORD0092308"])
    action_id = str(uuid.uuid4())

    check(loader_client, "ORD0092302", action_id=action_id, plan_version=2)

    assert checks_for(db_session, action_id) == []
    assert row_for(db_session, run, "ORD0092302").state == RunOrderState.TO_LOAD


def test_a_future_plan_version_is_also_409(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = check(loader_client, "ORD0092302", plan_version=9)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PLAN_VERSION_STALE"


# --- 404 / 422 -------------------------------------------------------------


def test_unknown_run_is_404(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = loader_client.post(order_url("ORD0092302", run="RUN-999"), json=body())

    assert response.status_code == 404


def test_order_not_on_the_current_plan_is_404(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    # ORD0092319 exists, but only joins the run in v3.
    response = check(loader_client, "ORD0092319")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "NOT_FOUND"


def test_unknown_session_is_404(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = check(loader_client, "ORD0092302", loader_session_id=999)

    assert response.status_code == 404


def test_client_action_id_and_plan_version_are_required(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    for bad in (
        {"plan_version": 2},
        {"client_action_id": str(uuid.uuid4())},
        {"client_action_id": "not-a-uuid", "plan_version": 2},
    ):
        response = loader_client.post(order_url("ORD0092302"), json=bad)
        assert response.status_code == 422, bad
