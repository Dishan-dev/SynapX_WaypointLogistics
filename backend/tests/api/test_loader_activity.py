"""L9: GET /loader/runs/{code}/activity - one run's log, newest first."""
import uuid

from app.models.delivery_run import RunStatus
from app.models.loader_activity import ActorKind
from app.models.loader_user import LoaderSession
from app.models.reference import DockTablet
from app.schemas.loader import SimulatedPlanChangeRequest
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    at,
    build_run_021,
    loader_client,
    make_dock,
    make_run,
    make_vehicle,
    make_loader,
    put_on_truck,
)

BASE = "/api/v1/loader"
RUN = "RUN-021"


def activity(client, run=RUN):
    return client.get(f"{BASE}/runs/{run}/activity")


def open_session(db, run, loader):
    tablet = DockTablet(label="Dock tablet 3", dock_id=run.dock_id)
    db.add(tablet)
    db.flush()
    session = LoaderSession(loader_user_id=loader.id, dock_tablet_id=tablet.id)
    db.add(session)
    db.flush()
    return session


def write(client, path, plan_version, session_id, method="POST"):
    return client.request(
        method,
        f"{BASE}/runs/{RUN}{path}",
        json={
            "client_action_id": str(uuid.uuid4()),
            "plan_version": plan_version,
            "loader_session_id": session_id,
        },
    )


def test_newest_first_with_ties_broken_by_id(loader_client, db_session):
    run, _ = build_run_021(db_session)
    for hhmm, message in [("02:14", "first"), ("02:20", "second"), ("02:20", "third")]:
        LoaderService.log(
            db_session, run, at=at(hhmm), actor_kind=ActorKind.SYSTEM,
            event_type="load_reopened", actor_label="System", message=message,
        )
    db_session.flush()

    response = activity(loader_client)

    assert response.status_code == 200, response.text
    assert [e["summary"] for e in response.json()] == ["third", "second", "first"]
    assert response.json()[0]["at"] == "2026-05-28T02:20:00Z"


def test_the_figma_story_reads_in_the_change_log_wording(loader_client, db_session):
    """T1c: published, acknowledged, unloaded -> chiller, loaded, re-checked."""
    run, _ = build_run_021(db_session)
    session = open_session(db_session, run, make_loader(db_session, "Nimal Perera", "Nimal P."))
    put_on_truck(db_session, run, "ORD0092308")
    LoaderService.simulate_plan_change(
        db_session, run,
        SimulatedPlanChangeRequest(
            unload_order_numbers=["ORD0092308"],
            load_new_order_numbers=["ORD0092319"],
        ),
    )
    db_session.flush()

    for path, method in [
        ("/plan/3/acknowledge", "POST"),
        ("/orders/ORD0092308/unload", "POST"),
        ("/orders/ORD0092302/check", "POST"),
        ("/orders/ORD0092302/check", "DELETE"),
    ]:
        response = write(loader_client, path, 3, session.id, method)
        assert response.status_code == 200, response.text

    events = activity(loader_client).json()

    assert [(e["type"], e["summary"]) for e in events] == [
        ("order_unchecked", "ORD0092302 unchecked"),
        ("order_checked", "ORD0092302 loaded"),
        ("order_unloaded", "ORD0092308 unloaded → chiller"),
        ("plan_acknowledged", "Acknowledged · Nimal P."),
        ("plan_published", "Dispatcher published plan v3"),
    ]

    unchecked, _, unloaded, acknowledged, published = events
    assert unchecked["actor"] == {"kind": "loader", "name": "Nimal P.", "full_name": "Nimal Perera"}
    assert unchecked["order"] == {"order_number": "ORD0092302"}
    # v3's new OUT028 stop comes first, so OUT026 is stop 2 on the current plan.
    assert unchecked["stop"] == {"sequence": 2, "outlet_code": "OUT026"}
    assert unloaded["details"] == {"return_area": "chiller"}
    assert acknowledged["order"] is None and acknowledged["stop"] is None
    assert published["actor"] == {"kind": "dispatcher", "name": "Dispatcher", "full_name": None}
    assert all(e["at"].endswith("Z") for e in events)
    assert all(set(e) == {"id", "type", "at", "actor", "stop", "order", "summary", "details"} for e in events)


def test_stored_messages_keep_the_dispatcher_wording(loader_client, db_session):
    """The dock-wide feed is unchanged: it still sends the stored message (Figma 2c #5)."""
    run, _ = build_run_021(db_session)
    session = open_session(db_session, run, make_loader(db_session, "Nimal Perera", "Nimal P."))
    LoaderService.simulate_plan_change(
        db_session, run, SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )
    db_session.flush()
    assert write(loader_client, "/plan/3/acknowledge", 3, session.id).status_code == 200

    [latest, *_] = activity(loader_client).json()
    [feed_latest, *_] = loader_client.get(f"{BASE}/activity?dock=3&run_code={RUN}").json()

    assert latest["summary"] == "Acknowledged · Nimal P."
    assert feed_latest["message"] == "Plan v3 received · Nimal Perera"


def test_other_event_types_pass_their_stored_message_through(loader_client, db_session):
    """An open set: decisions, the system and later types show as logged."""
    run, orders = build_run_021(db_session)
    run.status = RunStatus.READY_TO_DEPART
    LoaderService.log(
        db_session, run, at=at("02:20"), actor_kind=ActorKind.DISPATCHER,
        event_type="issue_decided", actor_label="Kasun Perera",
        order_id=orders["ORD0092301"].id, message="ORD0092301: send 53 of 56",
    )
    LoaderService.log(
        db_session, run, at=at("02:30"), actor_kind=ActorKind.LOADER,
        event_type="some_future_event", message="Something new happened",
    )
    db_session.flush()

    newest, decided = activity(loader_client).json()

    assert (newest["type"], newest["summary"]) == ("some_future_event", "Something new happened")
    assert newest["actor"] == {"kind": "loader", "name": None, "full_name": None}
    assert decided["summary"] == "ORD0092301: send 53 of 56"
    assert decided["actor"]["name"] == "Kasun Perera"
    assert decided["stop"] == {"sequence": 1, "outlet_code": "OUT026"}


def test_an_order_dropped_by_a_later_plan_keeps_its_stop(loader_client, db_session):
    run, orders = build_run_021(db_session)
    LoaderService.log(
        db_session, run, at=at("02:00"), actor_kind=ActorKind.LOADER,
        event_type="order_checked", order_id=orders["ORD0092304"].id,
        message="ORD0092304 loaded",
    )
    LoaderService.simulate_plan_change(
        db_session, run, SimulatedPlanChangeRequest(dont_load_order_numbers=["ORD0092304"])
    )
    db_session.flush()

    [checked] = [e for e in activity(loader_client).json() if e["type"] == "order_checked"]

    assert checked["stop"] == {"sequence": 2, "outlet_code": "OUT030"}


def test_a_run_with_no_activity_is_an_empty_list(loader_client, db_session):
    make_run(db_session, make_vehicle(db_session), make_dock(db_session), code="RUN-030")
    db_session.flush()

    response = activity(loader_client, "RUN-030")

    assert response.status_code == 200
    assert response.json() == []


def test_an_unknown_run_is_a_404(loader_client, db_session):
    response = activity(loader_client, "RUN-999")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "NOT_FOUND"
