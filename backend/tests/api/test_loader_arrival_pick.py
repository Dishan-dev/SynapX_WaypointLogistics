"""Truck arrival, the pick lock, depot scope and release notifications.

The run is built when the dispatcher dispatches the trip but stays hidden from
the loader queue until the driver taps "Arrived at dock". Loaders see every
dock of their depot; one loader picks a run and only they can work it while
their session is live. When a release can no longer be undone, the driver and
the depot's dispatcher are told once, in the app.

Everything here goes through strict_loader_client: every session header,
loader_session_id, pick and arrival is the test's own.
"""
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.models.delivery_run import RunStatus
from app.models.fleet import DriverProfile
from app.models.loader_activity import LoaderActivity
from app.models.loader_user import LoaderSession
from app.models.notification import Notification
from app.models.reference import Depot
from app.models.user import User, UserRole
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (strict_loader_client and trip_setup are fixtures)
    make_dock,
    make_loader,
    make_trip,
    strict_loader_client,
    trip_setup,
)

BASE = "/api/v1/loader"
NOTIFY = "/api/v1/notifications"
CODE = "RUN-0024"


def make_user(db, email, name, role):
    user = User(email=email, full_name=name, hashed_password=get_password_hash("pw123456"), role=role, is_active=True)
    db.add(user)
    db.flush()
    return user


def auth(user, depot=None):
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    if depot:
        headers["X-Waypoint-Depot"] = depot
    return headers


def open_session(db, loader):
    session = LoaderSession(loader_user_id=loader.id)
    db.add(session)
    db.flush()
    return session


def tab(session):
    return {"X-Loader-Session": str(session.id)}


def write(session, plan_version=1, **extra):
    return {
        "client_action_id": str(uuid.uuid4()),
        "plan_version": plan_version,
        "loader_session_id": session.id,
        **extra,
    }


def queue_codes(client, session):
    body = client.get(f"{BASE}/runs", headers=tab(session)).json()
    return {card["code"]: dock["dock"] for dock in body["docks"] for card in dock["runs"]}


def events(db, run, event_type):
    return db.execute(
        select(LoaderActivity).filter_by(run_id=run.id, event_type=event_type)
    ).scalars().all()


@pytest.fixture
def day(trip_setup):
    """RUN-0024 dispatched to Tharindu at Dock 3 (hidden: no truck yet);
    Saman and Nimal signed in at Peliyagoda; Dock 4 free; a Kandy dock."""
    db = trip_setup["db"]
    driver = make_user(db, "tharindu@waypoint.com", "Tharindu Fernando", UserRole.DRIVER)
    profile = DriverProfile(user_id=driver.id, license_type="Heavy", phone="0771234567")
    db.add(profile)
    db.flush()
    trip = make_trip(db, trip_setup["vehicle"], trip_setup["orders"])
    trip.driver_id = profile.id
    run = LoaderService.create_run_for_dispatch_trip(db, trip)
    saman, nimal = make_loader(db), make_loader(db, "Nimal Senanayake", "Nimal S.")
    kasun = make_loader(db, "Kasun Bandara", "Kasun B.", depot=Depot.KANDY)
    db.flush()
    return {
        "db": db, "trip": trip, "run": run, "driver": driver,
        "dock4": make_dock(db, "DOCK4", "Dock 4"),
        "kandy_dock": make_dock(db, "KDOCK1", "Kandy Dock 1", depot=Depot.KANDY),
        "saman": open_session(db, saman), "nimal": open_session(db, nimal), "kasun": open_session(db, kasun),
        "admin": make_user(db, "admin@waypoint.com", "Admin", UserRole.ADMIN),
        "orders": trip_setup["orders"],
    }


def arrive(client, day, dock="DOCK3", user=None, **extra):
    return client.post(
        f"{BASE}/dispatch-trips/{day['trip'].id}/arrived",
        json={"dock_code": dock, **extra},
        headers=auth(user or day["driver"]),
    )


def pick(client, session, code=CODE):
    return client.post(f"{BASE}/runs/{code}/pick", json={"loader_session_id": session.id})


# --- hidden until the truck arrives ------------------------------------------------


def test_the_run_is_hidden_until_the_driver_says_the_truck_arrived(strict_loader_client, day):
    client, saman = strict_loader_client, day["saman"]

    assert CODE not in queue_codes(client, saman)
    assert client.get(f"{BASE}/runs/{CODE}", headers=tab(saman)).status_code == 404
    assert pick(client, saman).status_code == 404
    loading = client.get(f"{BASE}/dispatch-trips/{day['trip'].id}/loading").json()
    assert (loading["stage"], loading["arrived_at"], loading["dock"]) == ("awaiting_truck", None, "DOCK3")

    response = arrive(client, day)

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["run_code"], body["dock"], body["dock_code"], body["stage"], body["replayed"]) == (
        CODE, "Dock 3", "DOCK3", "at_dock", False,
    )
    assert queue_codes(client, saman) == {CODE: "Dock 3"}
    detail = client.get(f"{BASE}/runs/{CODE}", headers=tab(saman)).json()
    assert (detail["stage"], detail["arrived_at"]) == ("at_dock", body["arrived_at"])
    [logged] = events(day["db"], day["run"], "truck_arrived")
    assert (logged.message, logged.actor_label) == ("Arrived at Dock 3", "Tharindu Fernando")
    assert day["trip"].loading_events[-1]["event"] == "Truck at dock"


def test_arrival_is_idempotent_and_the_first_one_wins(strict_loader_client, day):
    first = arrive(strict_loader_client, day).json()
    again = arrive(strict_loader_client, day, dock="DOCK4")

    assert again.status_code == 200
    assert again.json()["replayed"] is True
    assert (again.json()["dock_code"], again.json()["arrived_at"]) == ("DOCK3", first["arrived_at"])
    assert len(events(day["db"], day["run"], "truck_arrived")) == 1


def test_arrival_keeps_an_offline_tap_time_but_never_a_future_one(strict_loader_client, day):
    tapped = (datetime.utcnow() - timedelta(minutes=7)).replace(microsecond=0)

    body = arrive(strict_loader_client, day, arrived_at=tapped.isoformat() + "Z").json()

    assert body["arrived_at"] == tapped.isoformat() + "Z"


def test_a_future_tap_time_is_clamped_to_now(strict_loader_client, day):
    future = datetime.utcnow() + timedelta(hours=2)

    arrive(strict_loader_client, day, arrived_at=future.isoformat() + "Z")

    assert day["run"].arrived_at <= datetime.utcnow()


def test_another_dock_at_the_same_depot_moves_the_run_there(strict_loader_client, day):
    response = arrive(strict_loader_client, day, dock="Dock 4")

    assert response.status_code == 200, response.text
    assert response.json()["dock_code"] == "DOCK4"
    assert day["run"].dock_id == day["run"].arrived_dock_id == day["dock4"].id
    assert queue_codes(strict_loader_client, day["saman"]) == {CODE: "Dock 4"}
    [logged] = events(day["db"], day["run"], "truck_arrived")
    assert logged.message == "Arrived at Dock 4 (planned Dock 3)"


def test_another_depots_dock_is_a_422(strict_loader_client, day):
    response = arrive(strict_loader_client, day, dock="KDOCK1")

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "DOCK_NOT_AT_DEPOT"
    assert day["run"].arrived_at is None


def test_only_the_trips_driver_can_say_it_arrived(strict_loader_client, day):
    db = day["db"]
    manager = make_user(db, "store@waypoint.com", "Store Manager", UserRole.STORE_MANAGER)
    other = make_user(db, "kamal@waypoint.com", "Kamal Silva", UserRole.DRIVER)
    db.add(DriverProfile(user_id=other.id, license_type="Heavy", phone="0777654321"))
    db.flush()

    assert arrive(strict_loader_client, day, user=manager).status_code == 403
    assert arrive(strict_loader_client, day, user=other).status_code == 403
    assert day["run"].arrived_at is None


def test_arrival_before_the_run_is_built_is_a_404(strict_loader_client, day):
    db = day["db"]
    trip = make_trip(db, day["run"].vehicle, [], code="RUN-0099")
    trip.driver_id = day["trip"].driver_id
    db.flush()

    response = strict_loader_client.post(
        f"{BASE}/dispatch-trips/{trip.id}/arrived", json={"dock_code": "DOCK3"}, headers=auth(day["driver"])
    )

    assert response.status_code == 404


# --- the dispatcher's dock ----------------------------------------------------------


def change_dock(client, day, dock):
    return client.post(
        f"{BASE}/dispatch-trips/{day['trip'].id}/dock",
        json={"dock_code": dock},
        headers=auth(day["admin"], "peliyagoda"),
    )


def test_the_dispatcher_can_change_the_dock_until_the_truck_arrives(strict_loader_client, day):
    moved = change_dock(strict_loader_client, day, "DOCK4")

    assert moved.status_code == 200, moved.text
    assert (moved.json()["dock"], moved.json()["dock_name"]) == ("DOCK4", "Dock 4")
    assert events(day["db"], day["run"], "dock_changed")[0].message == "Dock changed: Dock 3 -> Dock 4"
    assert change_dock(strict_loader_client, day, "KDOCK1").json()["detail"]["code"] == "DOCK_NOT_AT_DEPOT"

    arrive(strict_loader_client, day, dock="DOCK4")
    late = change_dock(strict_loader_client, day, "DOCK3")

    assert late.status_code == 409
    assert late.json()["detail"]["code"] == "TRUCK_ALREADY_ARRIVED"


def test_a_dispatch_with_another_depots_dock_cannot_be_built(trip_setup):
    db = trip_setup["db"]
    make_dock(db, "KDOCK1", "Kandy Dock 1", depot=Depot.KANDY)
    trip = make_trip(db, trip_setup["vehicle"], trip_setup["orders"])

    with pytest.raises(Exception) as caught:
        LoaderService.create_run_for_dispatch_trip(db, trip, dock_code="KDOCK1")

    assert [v["code"] for v in caught.value.details["violations"]] == ["NO_DOCK"]


def test_the_dispatchers_dock_choice_is_used(trip_setup):
    db = trip_setup["db"]
    make_dock(db, "DOCK4", "Dock 4")
    trip = make_trip(db, trip_setup["vehicle"], trip_setup["orders"])

    run = LoaderService.create_run_for_dispatch_trip(db, trip, dock_code="DOCK4")

    assert run.dock.code == "DOCK4"
    assert run.arrived_at is None


def test_the_docks_list_is_one_depots(strict_loader_client, day):
    body = strict_loader_client.get(f"{BASE}/docks", params={"depot": "peliyagoda"}).json()

    assert [d["code"] for d in body] == ["DOCK3", "DOCK4"]


# --- plan changes before arrival ---------------------------------------------------


def test_a_plan_change_before_arrival_applies_to_the_hidden_run(strict_loader_client, day):
    client = strict_loader_client
    changed = client.post(
        f"{BASE}/dispatch-trips/{day['trip'].id}/plan",
        json={"client_action_id": str(uuid.uuid4()), "base_version": 1, "remove": [{"order_number": "ORD1003"}]},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["plan_version"] == 2

    arrive(client, day)
    detail = client.get(f"{BASE}/runs/{CODE}", headers=tab(day["saman"])).json()

    assert detail["current_plan_version"] == 2
    # v2 took ORD1003 off: listed greyed out (moved), not counted.
    states = {o["order_number"]: o["state"] for s in detail["stops"] for o in s["orders"]}
    assert states == {"ORD1001": "to_load", "ORD1002": "to_load", "ORD1003": "moved", "ORD1004": "to_load"}
    assert detail["orders_total"] == 3
    # Nobody saw v1, so the tablet shows the first-plan screen at v2: no diff.
    assert (detail["unacknowledged_plan_version"], detail["acknowledged_plan_version"]) == (2, None)
    assert detail["plan_change"] is None


# --- the pick lock -----------------------------------------------------------------


@pytest.fixture
def picked(strict_loader_client, day):
    """The truck is at Dock 3 and Saman has picked RUN-0024 and read plan v1."""
    arrive(strict_loader_client, day)
    assert pick(strict_loader_client, day["saman"]).status_code == 200
    ack = strict_loader_client.post(
        f"{BASE}/runs/{CODE}/plan/1/acknowledge", json=write(day["saman"])
    )
    assert ack.status_code == 200, ack.text
    return day


def order_url(number, verb="check"):
    return f"{BASE}/runs/{CODE}/orders/{number}/{verb}"


def test_a_second_loader_is_refused_everywhere_while_the_run_is_picked(strict_loader_client, picked):
    client, nimal = strict_loader_client, picked["nimal"]

    refused = [
        client.get(f"{BASE}/runs/{CODE}", headers=tab(nimal)),
        pick(client, nimal),
        client.post(order_url("ORD1001"), json=write(nimal)),
        client.post(f"{BASE}/issues", json=write(
            nimal, run_code=CODE, order_number="ORD1001", issue_type="missing", units_affected=12,
        )),
        client.post(f"{BASE}/runs/{CODE}/plan/1/acknowledge", json=write(nimal)),
        client.post(f"{BASE}/runs/{CODE}/release", json=write(nimal)),
        client.post(f"{BASE}/runs/{CODE}/release/undo", json=write(nimal)),
        client.post(f"{BASE}/runs/{CODE}/unpick", json={"loader_session_id": nimal.id}),
    ]

    for response in refused:
        assert response.status_code == 409, response.text
        assert response.json()["detail"]["code"] == "RUN_PICKED_BY_OTHER"
        assert response.json()["detail"]["picked_by"] == "Saman J."


def test_the_cards_say_who_is_loading(strict_loader_client, picked):
    def card(session):
        body = strict_loader_client.get(f"{BASE}/runs", headers=tab(session)).json()
        return next(c for d in body["docks"] for c in d["runs"] if c["code"] == CODE)

    mine, theirs = card(picked["saman"]), card(picked["nimal"])

    assert (mine["stage"], mine["picked_by"], mine["picked_by_me"]) == ("loading", "Saman J.", True)
    assert (theirs["picked_by"], theirs["picked_by_me"]) == ("Saman J.", False)
    assert theirs["arrived_at"] is not None


def test_a_write_on_a_run_nobody_picked_is_refused(strict_loader_client, day):
    arrive(strict_loader_client, day)

    response = strict_loader_client.post(f"{BASE}/runs/{CODE}/plan/1/acknowledge", json=write(day["nimal"]))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "RUN_NOT_PICKED"


def test_the_holders_offline_taps_still_land_after_an_idle_sign_out(strict_loader_client, picked):
    client, saman, nimal = strict_loader_client, picked["saman"], picked["nimal"]
    first = write(saman)
    assert client.post(order_url("ORD1001"), json=first).status_code == 200
    client.request("DELETE", f"{BASE}/session/{saman.id}", json={"end_reason": "idle_timeout"})

    # Taps queued offline before the timeout reach the server afterwards.
    later = client.post(order_url("ORD1002"), json=write(saman))
    replay = client.post(order_url("ORD1001"), json=first)
    assert (later.status_code, replay.status_code) == (200, 200), later.text

    # Once Nimal picks it, Saman's new taps are refused; a replay still answers 200.
    assert pick(client, nimal).status_code == 200
    refused = client.post(order_url("ORD1003"), json=write(saman))
    assert refused.status_code == 409
    assert refused.json()["detail"]["code"] == "RUN_PICKED_BY_OTHER"
    assert client.post(order_url("ORD1001"), json=first).status_code == 200


def test_signing_out_lifts_the_lock(strict_loader_client, picked):
    client = strict_loader_client
    client.request("DELETE", f"{BASE}/session/{picked['saman'].id}", json={"end_reason": "sign_out"})

    assert pick(client, picked["nimal"]).status_code == 200
    assert picked["run"].picked_by.short_name == "Nimal S."


def test_switching_user_lifts_the_lock(strict_loader_client, picked):
    client = strict_loader_client
    client.request("DELETE", f"{BASE}/session/{picked['saman'].id}", json={"end_reason": "switch_user"})

    assert pick(client, picked["nimal"]).status_code == 200


def test_the_lock_lifts_after_11_minutes_without_a_sign_of_the_tablet(strict_loader_client, picked):
    client, saman = strict_loader_client, picked["saman"]
    saman.last_seen_at = datetime.utcnow() - timedelta(minutes=10)
    picked["db"].flush()
    assert pick(client, picked["nimal"]).status_code == 409

    saman.last_seen_at = datetime.utcnow() - timedelta(minutes=12)
    picked["db"].flush()
    assert pick(client, picked["nimal"]).status_code == 200


def test_reads_keep_the_holders_lock_alive(strict_loader_client, picked):
    saman = picked["saman"]
    saman.last_seen_at = datetime.utcnow() - timedelta(minutes=10)
    picked["db"].flush()

    strict_loader_client.get(f"{BASE}/runs", headers=tab(saman))

    assert datetime.utcnow() - saman.last_seen_at < timedelta(minutes=1)


def test_unpick_puts_the_run_back(strict_loader_client, picked):
    client = strict_loader_client

    back = client.post(f"{BASE}/runs/{CODE}/unpick", json={"loader_session_id": picked["saman"].id})

    assert back.status_code == 200
    assert back.json()["picked_by"] is None
    assert pick(client, picked["nimal"]).status_code == 200
    # Saman put it back: their next tap needs a pick, like anyone's.
    refused = client.post(order_url("ORD1001"), json=write(picked["saman"]))
    assert refused.json()["detail"]["code"] == "RUN_PICKED_BY_OTHER"


def test_signing_back_in_takes_over_your_own_pick(strict_loader_client, picked):
    again = open_session(picked["db"], picked["saman"].loader_user)

    assert pick(strict_loader_client, again).status_code == 200
    assert picked["run"].picked_session_id == again.id
    assert len(events(picked["db"], picked["run"], "run_picked")) == 1


# --- depot scope -------------------------------------------------------------------


def test_another_depots_loader_sees_nothing_of_it(strict_loader_client, picked):
    client, kasun = strict_loader_client, picked["kasun"]

    assert queue_codes(client, kasun) == {}
    assert client.get(f"{BASE}/runs/{CODE}", headers=tab(kasun)).status_code == 404
    assert client.get(f"{BASE}/runs/{CODE}/activity", headers=tab(kasun)).status_code == 404
    assert pick(client, kasun).status_code == 404
    assert client.post(order_url("ORD1001"), json=write(kasun)).status_code == 404
    assert client.get(f"{BASE}/runs", params={"dock": "DOCK3"}, headers=tab(kasun)).status_code == 404


def test_an_ended_session_cannot_read(strict_loader_client, day):
    saman = day["saman"]
    saman.ended_at = datetime.utcnow()
    day["db"].flush()

    response = strict_loader_client.get(f"{BASE}/runs", headers=tab(saman))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "LOADER_SESSION_ENDED"


# --- release notification ----------------------------------------------------------


def release(client, day, session=None):
    session = session or day["saman"]
    for number in ("ORD1001", "ORD1002", "ORD1003", "ORD1004"):
        response = client.post(order_url(number), json=write(session, day["run"].current_plan_version))
        assert response.status_code == 200, response.text
    released = client.post(f"{BASE}/runs/{CODE}/release", json=write(session, day["run"].current_plan_version))
    assert released.status_code == 200, released.text
    return released


def window_closes(day):
    day["run"].released_at = day["run"].released_at - timedelta(seconds=13)
    day["db"].flush()


def driver_notes(client, day):
    return client.get(f"{NOTIFY}/driver", headers=auth(day["driver"])).json()


def dispatcher_notes(client, day):
    return client.get(f"{NOTIFY}/dispatcher", headers=auth(day["admin"], "peliyagoda")).json()


def test_the_driver_and_dispatcher_are_told_once_after_the_undo_window(strict_loader_client, picked):
    client = strict_loader_client
    release(client, picked)

    assert driver_notes(client, picked) == []  # the undo window is still open
    window_closes(picked)

    [to_driver] = driver_notes(client, picked)
    [to_dispatcher] = dispatcher_notes(client, picked)
    hhmm = (picked["run"].released_at + timedelta(hours=5, minutes=30)).strftime("%H:%M")
    assert (to_driver["type"], to_driver["title"]) == ("run_released", "RUN-0024 is ready at Dock 3")
    assert to_driver["message"] == f"Loaded by Saman J. at {hhmm} · 4 of 4 orders. Start the trip when you're ready."
    assert to_driver["dispatch_trip_id"] == picked["trip"].id and to_driver["outlet_id"] is None
    assert to_dispatcher["title"] == "RUN-0024 · VEH014 released at Dock 3"
    assert to_dispatcher["message"] == f"Saman J. at {hhmm} · 4 of 4 orders."

    # Read again: still one each.
    assert len(driver_notes(client, picked)) == len(dispatcher_notes(client, picked)) == 1
    assert client.get(f"{NOTIFY}/dispatcher", headers=auth(picked["admin"], "kandy")).json() == []


def test_a_notification_can_be_marked_read_by_its_recipient_only(strict_loader_client, picked):
    client = strict_loader_client
    release(client, picked)
    window_closes(picked)
    [note] = driver_notes(client, picked)

    other = make_user(picked["db"], "kamal@waypoint.com", "Kamal Silva", UserRole.DRIVER)
    assert client.patch(f"{NOTIFY}/driver/{note['id']}/read", headers=auth(other)).status_code == 404
    read = client.patch(f"{NOTIFY}/driver/{note['id']}/read", headers=auth(picked["driver"]))

    assert read.status_code == 200 and read.json()["is_read"] is True
    [dispatch_note] = dispatcher_notes(client, picked)
    assert client.patch(
        f"{NOTIFY}/dispatcher/{dispatch_note['id']}/read", headers=auth(picked["admin"], "peliyagoda")
    ).json()["is_read"] is True


def test_an_undone_release_tells_nobody(strict_loader_client, picked):
    client = strict_loader_client
    release(client, picked)
    undo = client.post(f"{BASE}/runs/{CODE}/release/undo", json=write(picked["saman"]))
    assert undo.status_code == 200, undo.text

    assert picked["run"].released_at is None
    assert driver_notes(client, picked) == []
    assert dispatcher_notes(client, picked) == []
    assert picked["db"].query(Notification).count() == 0


def test_a_reopened_and_released_again_run_is_told_again(strict_loader_client, picked):
    client, db = strict_loader_client, picked["db"]
    release(client, picked)
    window_closes(picked)
    assert len(driver_notes(client, picked)) == 1

    changed = client.post(
        f"{BASE}/dispatch-trips/{picked['trip'].id}/plan",
        json={"client_action_id": str(uuid.uuid4()), "base_version": 1, "departs_at": None,
              "remove": [{"order_number": "ORD1003"}]},
    )
    assert changed.status_code == 200, changed.text
    assert picked["run"].status == RunStatus.LOADING
    assert len(driver_notes(client, picked)) == 1  # reopened: nothing new yet

    ack = client.post(f"{BASE}/runs/{CODE}/plan/2/acknowledge", json=write(picked["saman"], 2))
    assert ack.status_code == 200, ack.text
    detail = client.get(f"{BASE}/runs/{CODE}", headers=tab(picked["saman"])).json()
    for stop in detail["stops"]:
        for order in stop["orders"]:
            verb = {"take_off": "unload", "re_check": "check"}.get(order["state"])
            if verb:
                response = client.post(order_url(order["order_number"], verb), json=write(picked["saman"], 2))
                assert response.status_code == 200, response.text
    again = client.post(f"{BASE}/runs/{CODE}/release", json=write(picked["saman"], 2))
    assert again.status_code == 200, again.text
    window_closes(picked)

    notes = driver_notes(client, picked)
    assert len(notes) == 2
    assert notes[0]["message"].endswith("3 of 3 orders. Start the trip when you're ready.")
    assert len(dispatcher_notes(client, picked)) == 2
    assert db.query(Notification).count() == 4
