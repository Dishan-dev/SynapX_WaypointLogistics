"""Fields Sanduni's screens need on the run read, and the helpers her L3/L6
endpoints call (API_CONTRACT.md)."""
from datetime import timedelta, timezone

from app.core.exceptions import InvalidStateTransitionError
from app.models.delivery_run import RunOrderState, RunStatus
from app.models.loader_issue import IssueType
from app.schemas.loader import SimulatedPlanChangeRequest
from app.services.loader_service import LoaderService, ReleaseLockedError, UndoWindowExpiredError
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    at,
    build_run_021,
    loader_client,
    make_issue,
    make_dock,
    make_loader,
    make_revision,
    make_run,
    put_on_truck,
)

BASE = "/api/v1/loader"
RUN = "RUN-021"


def run_body(client):
    return client.get(f"{BASE}/runs/{RUN}").json()


# --- released_at / released_by ------------------------------------------------


def sign_off(db, run, loader, status=RunStatus.READY_TO_DEPART):
    run.status = status
    run.released_at = at("03:06")
    run.released_by_id = loader.id
    db.flush()


def test_a_run_not_yet_released_has_no_release(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    body = run_body(loader_client)

    assert (body["released_at"], body["released_by"]) == (None, None)


def test_a_ready_run_says_who_signed_it_off(loader_client, db_session):
    run, _ = build_run_021(db_session)
    saman = make_loader(db_session, "Saman Jayawardena", "Saman J.")
    sign_off(db_session, run, saman)

    body = run_body(loader_client)

    assert body["released_at"] == "2026-05-28T03:06:00Z"
    assert body["released_by"] == {"id": saman.id, "name": "Saman J."}


def test_a_gated_out_run_keeps_its_release(loader_client, db_session):
    run, _ = build_run_021(db_session)
    sign_off(db_session, run, make_loader(db_session, "Nimal Silva", "Nimal S."), RunStatus.GATED_OUT)

    assert run_body(loader_client)["released_by"]["name"] == "Nimal S."


def test_an_undone_release_is_null_again(loader_client, db_session):
    """Undo (L6) clears the columns; the read has nothing to show."""
    run, _ = build_run_021(db_session)
    sign_off(db_session, run, make_loader(db_session))
    run.status = RunStatus.LOADED
    run.released_at = None
    run.released_by_id = None
    db_session.flush()

    body = run_body(loader_client)

    assert (body["released_at"], body["released_by"]) == (None, None)


def test_a_reopened_run_is_not_released_but_keeps_was_ready_at(loader_client, db_session):
    """The column keeps the time for the takeover; the API does not call it released."""
    run, _ = build_run_021(db_session)
    sign_off(db_session, run, make_loader(db_session))
    LoaderService.simulate_plan_change(
        db_session, run, SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )
    db_session.flush()

    body = run_body(loader_client)

    assert body["status"] == "loading"
    assert (body["released_at"], body["released_by"]) == (None, None)
    assert body["plan_change"]["was_ready_at"] == "2026-05-28T03:06:00Z"


# --- loaded_units -----------------------------------------------------------------


def loaded_units(client):
    return {
        o["order_number"]: o["loaded_units"]
        for s in run_body(client)["stops"]
        for o in s["orders"]
    }


def flag(db, run, orders, number, issue_type, units_affected):
    issue = make_issue(db, run, orders[number], make_loader(db, "Tharindu J", f"T.{number}"))
    issue.issue_type = IssueType(issue_type)
    issue.units_affected = units_affected
    put_on_truck(db, run, number).state = RunOrderState.FLAGGED
    db.flush()


def test_loaded_orders_carry_every_unit_and_open_ones_none(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    units = loaded_units(loader_client)

    assert units["ORD0092301"] == 56  # loaded
    assert units["ORD0092302"] == 0  # to_load


def test_short_damaged_and_wont_fit_take_off_the_flagged_units(loader_client, db_session):
    run, orders = build_run_021(db_session)
    flag(db_session, run, orders, "ORD0092302", "short", 3)  # 46 units
    flag(db_session, run, orders, "ORD0092304", "damaged", 5)  # 30 units
    flag(db_session, run, orders, "ORD0092308", "wont_fit", 26)  # 26 units

    units = loaded_units(loader_client)

    assert (units["ORD0092302"], units["ORD0092304"], units["ORD0092308"]) == (43, 25, 0)


def test_a_missing_order_has_nothing_aboard(loader_client, db_session):
    run, orders = build_run_021(db_session)
    flag(db_session, run, orders, "ORD0092302", "missing", 46)

    assert loaded_units(loader_client)["ORD0092302"] == 0


def test_a_flag_without_a_count_means_the_whole_order_is_affected(loader_client, db_session):
    run, orders = build_run_021(db_session)
    flag(db_session, run, orders, "ORD0092302", "short", None)
    flag(db_session, run, orders, "ORD0092304", "damaged", None)
    flag(db_session, run, orders, "ORD0092308", "wont_fit", None)

    units = loaded_units(loader_client)

    assert (units["ORD0092302"], units["ORD0092304"], units["ORD0092308"]) == (0, 0, 0)


def test_re_check_and_an_outstanding_take_off_are_still_aboard(loader_client, db_session):
    run, _ = build_run_021(db_session)
    put_on_truck(db_session, run, "ORD0092308")
    LoaderService.simulate_plan_change(
        db_session, run,
        SimulatedPlanChangeRequest(
            unload_order_numbers=["ORD0092308"],
            dont_load_order_numbers=["ORD0092304"],
            recheck_order_numbers=["ORD0092305"],
        ),
    )
    db_session.flush()

    units = loaded_units(loader_client)

    assert units["ORD0092305"] == 48  # re_check
    assert units["ORD0092308"] == 26  # take_off, not yet unloaded
    assert units["ORD0092304"] == 0  # moved


# --- release lock and undo window (helpers for L6) ------------------------------


def error_client(exc):
    """A throwaway app with the real exception handlers, raising exc."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.core.exceptions import register_exception_handlers

    app = FastAPI()
    register_exception_handlers(app)

    @app.post("/raise")
    def _raise():
        raise exc

    return TestClient(app)


def test_release_locked_sends_the_blockers_in_the_detail(db_session):
    run, _ = build_run_021(db_session)

    try:
        LoaderService.check_release_allowed(db_session, run)
    except ReleaseLockedError as exc:
        response = error_client(exc).post("/raise")
    else:
        raise AssertionError("an open run was allowed to release")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "RELEASE_LOCKED"
    assert detail["entity_id"] == "RUN-021"
    assert detail["release_blockers"] == [{"code": "orders_open", "count": 3}]


def test_nothing_blocking_means_release_is_allowed(db_session):
    run, _ = build_run_021(db_session)
    for stop in LoaderService.current_stops(db_session, run):
        for row in stop.orders:
            row.state = RunOrderState.LOADED
    db_session.flush()

    LoaderService.check_release_allowed(db_session, run)  # does not raise


def ready_run(db):
    run, _ = build_run_021(db)
    run.status = RunStatus.READY_TO_DEPART
    run.released_at = at("03:06")
    db.flush()
    return run


def after(seconds):
    return at("03:06") + timedelta(seconds=seconds)


def test_undo_is_allowed_inside_the_window_and_the_grace(db_session):
    run = ready_run(db_session)

    LoaderService.check_undo_allowed(run, now=after(0))
    LoaderService.check_undo_allowed(run, now=after(10))
    LoaderService.check_undo_allowed(run, now=after(12))  # 10 s + 2 s grace


def test_undo_after_the_grace_is_undo_window_expired(db_session):
    run = ready_run(db_session)

    try:
        LoaderService.check_undo_allowed(run, now=after(12.1))
    except UndoWindowExpiredError as exc:
        response = error_client(exc).post("/raise")
    else:
        raise AssertionError("undo was allowed after the window")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "UNDO_WINDOW_EXPIRED"
    assert detail["released_at"] == "2026-05-28T03:06:00Z"
    assert detail["window_seconds"] == 10


def test_undo_takes_an_aware_now_as_well(db_session):
    """A stored (naive UTC) release time against a fresh aware clock."""
    run = ready_run(db_session)

    LoaderService.check_undo_allowed(run, now=after(5).replace(tzinfo=timezone.utc))


def test_undo_of_a_run_that_is_not_ready_is_an_invalid_transition(db_session):
    run = ready_run(db_session)
    for status in (RunStatus.LOADING, RunStatus.GATED_OUT, RunStatus.LOADED):
        run.status = status

        try:
            LoaderService.check_undo_allowed(run, now=after(1))
        except UndoWindowExpiredError:
            raise AssertionError(f"{status.value}: reported as a closed window")
        except InvalidStateTransitionError as exc:
            assert exc.code == "INVALID_STATE_TRANSITION", status
        else:
            raise AssertionError(f"{status.value}: undo was allowed")


# --- plan_updated_at (helpers for L3) ----------------------------------------------


def test_a_runs_plan_updated_at_is_its_current_plans_publish_time(db_session):
    run, _ = build_run_021(db_session)

    assert LoaderService.plan_updated_at(db_session, run) == at("21:40")

    revision = LoaderService.simulate_plan_change(
        db_session, run, SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )
    db_session.flush()

    assert LoaderService.plan_updated_at(db_session, run) == revision.published_at


def test_the_dock_plan_updated_at_is_the_latest_current_plan(db_session):
    run, _ = build_run_021(db_session)
    other = make_run(db_session, run.vehicle, run.dock, code="RUN-027", plan_version=1)
    make_revision(db_session, other, version=1)
    newest = make_revision(db_session, other, version=5)  # not other's current version
    newest.published_at = at("23:59")
    other_current = LoaderService.get_revision(db_session, other, 1)
    other_current.published_at = at("22:30")
    db_session.flush()

    # A newer revision that is not a run's current plan does not count.
    assert LoaderService.dock_plan_updated_at(db_session, run.dock) == at("22:30")
    # Narrowed to the runs the queue shows.
    assert LoaderService.dock_plan_updated_at(db_session, run.dock, run_ids=[run.id]) == at("21:40")


def test_a_dock_with_no_plans_has_no_plan_updated_at(db_session):
    build_run_021(db_session)
    other_dock = make_dock(db_session, code="DOCK9", name="Dock 9")

    assert LoaderService.dock_plan_updated_at(db_session, other_dock) is None
