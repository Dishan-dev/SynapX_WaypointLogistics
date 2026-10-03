"""Driver API on loader runs: a run the loader signs off becomes the driver's trip,
and the driver's progress reaches the loader, dispatcher and store.

Built on the loader's trip_setup (VEH014, three Fresh outlets, four orders):
the dispatcher's trip names the driver, the loader builds and releases the run.
"""
import pytest
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.models.delivery_run import RunOrderState, RunStatus, RunStop, RunStopOrder
from app.models.driver import DeliveryStop, DriverTrip
from app.models.fleet import DriverProfile
from app.models.notification import Notification, NotificationType
from app.models.order import OrderStatus
from app.models.shipment import DispatchTrip
from app.models.user import User, UserRole
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (loader_client and trip_setup are fixtures)
    loader_client,
    make_outlet,
    make_run_order,
    make_stop,
    make_trip,
    trip_setup,
)

API = "/api/v1/driver"
SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
FLAGGED = "ORD1003"  # the loader couldn't find it: on the plan, not on the truck


def make_driver(db, email="tharindu@waypoint.com", name="Tharindu Fernando", vehicle=None):
    user = User(
        email=email, full_name=name, hashed_password=get_password_hash("driver123"),
        role=UserRole.DRIVER, is_active=True,
    )
    db.add(user)
    db.flush()
    profile = DriverProfile(
        user_id=user.id, license_type="Heavy", phone="0771234567",
        assigned_vehicle_id=vehicle.id if vehicle else None,
    )
    db.add(profile)
    db.flush()
    return user, profile


def auth(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def run_rows(db, run):
    return db.execute(
        select(RunStopOrder).join(RunStop, RunStopOrder.run_stop_id == RunStop.id).where(RunStop.run_id == run.id)
    ).scalars().all()


def release(db, run, flagged=(FLAGGED,)):
    """The loader's sign-off: every order checked except the flagged ones."""
    for row in run_rows(db, run):
        row.state = RunOrderState.FLAGGED if row.order.order_number in flagged else RunOrderState.LOADED
    run.status = RunStatus.READY_TO_DEPART
    db.flush()


@pytest.fixture
def dispatched(trip_setup):
    """Dispatcher has sent RUN-0024 to Tharindu; the loader built the run (not released yet)."""
    db = trip_setup["db"]
    driver, profile = make_driver(db)
    trip = make_trip(db, trip_setup["vehicle"], trip_setup["orders"])
    trip.driver_id = profile.id
    run = LoaderService.create_run_for_dispatch_trip(db, trip)
    orders = {order.order_number: order for order in trip_setup["orders"]}
    return {"db": db, "driver": driver, "dispatch_trip": trip, "run": run, "orders": orders}


@pytest.fixture
def released(dispatched):
    release(dispatched["db"], dispatched["run"])
    return dispatched


def today(client, driver):
    res = client.get(f"{API}/trips/today", headers=auth(driver))
    assert res.status_code == 200, res.text
    return res.json()


def trip_detail(client, driver, trip_id):
    res = client.get(f"{API}/trips/{trip_id}", headers=auth(driver))
    assert res.status_code == 200, res.text
    return res.json()


def start(client, driver, trip_id):
    res = client.post(f"{API}/trips/{trip_id}/start", headers=auth(driver))
    assert res.status_code == 200, res.text
    return res.json()


def deliver(client, driver, stop_id, outcome="delivered"):
    assert client.patch(f"{API}/stops/{stop_id}/arrive", headers=auth(driver)).status_code == 200
    res = client.patch(f"{API}/stops/{stop_id}/outcome", headers=auth(driver), json={"outcome": outcome})
    assert res.status_code == 200, res.text
    res = client.post(
        f"{API}/stops/{stop_id}/pod", headers=auth(driver),
        json={"recipient_name": "Malini Perera", "signature_data": SIGNATURE},
    )
    assert res.status_code == 200, res.text


def started_trip(client, setup):
    trip = today(client, setup["driver"])[0]
    start(client, setup["driver"], trip["id"])
    return trip_detail(client, setup["driver"], trip["id"])


# ---- Hand-off from the loader --------------------------------------------------

def test_run_shows_only_once_the_loader_signs_it_off(loader_client, dispatched):
    db, driver = dispatched["db"], dispatched["driver"]
    assert today(loader_client, driver) == []

    release(db, dispatched["run"])
    trips = today(loader_client, driver)

    assert len(trips) == 1
    assert trips[0]["status"] == "assigned"
    assert trips[0]["dispatch_trip_id"] == dispatched["dispatch_trip"].id


def test_trip_stops_follow_the_run_stop_order(loader_client, released):
    db, driver, run = released["db"], released["driver"], released["run"]
    trip = trip_detail(loader_client, driver, today(loader_client, driver)[0]["id"])

    planned = db.execute(
        select(RunStop).where(RunStop.run_id == run.id, RunStop.plan_version == run.current_plan_version)
        .order_by(RunStop.stop_sequence)
    ).scalars().all()
    stops = sorted(trip["stops"], key=lambda stop: stop["sequence"])
    assert [(s["sequence"], s["customer_name"]) for s in stops] == [
        (rs.stop_sequence, rs.outlet.name) for rs in planned
    ]
    assert all(s["latitude"] and s["longitude"] for s in stops)
    assert all(s["status"] == "pending" for s in stops)
    assert stops[0]["customer_name"] == "Outlet OUT027"  # earliest window goes first
    assert stops[0]["notes"] == "Rear dock · window 02:30-08:00"


def test_trip_shows_planned_departure_and_last_window(loader_client, released):
    trip = trip_detail(loader_client, released["driver"], today(loader_client, released["driver"])[0]["id"])

    assert trip["planned_departure"] == "2026-05-28T03:30:00Z"  # the dispatcher's departure
    assert trip["last_window_closes"] == "08:00"


def test_listing_again_makes_no_duplicates(loader_client, released):
    db, driver = released["db"], released["driver"]
    first = today(loader_client, driver)
    second = today(loader_client, driver)

    assert [t["id"] for t in first] == [t["id"] for t in second]
    assert len(db.execute(select(DriverTrip)).scalars().all()) == 1
    assert len(db.execute(select(DeliveryStop)).scalars().all()) == 3


def test_another_driver_does_not_see_the_run(loader_client, released):
    other, _ = make_driver(released["db"], email="kamal@waypoint.com", name="Kamal Silva")
    assert today(loader_client, other) == []
    assert len(today(loader_client, released["driver"])) == 1


def test_trip_with_no_driver_named_goes_to_the_vehicles_driver(loader_client, trip_setup):
    db = trip_setup["db"]
    driver, _ = make_driver(db, vehicle=trip_setup["vehicle"])
    trip = make_trip(db, trip_setup["vehicle"], trip_setup["orders"])  # driver_id left empty
    run = LoaderService.create_run_for_dispatch_trip(db, trip)
    release(db, run)

    assert len(today(loader_client, driver)) == 1


def test_plan_change_before_start_updates_the_stops(loader_client, released):
    db, driver, run = released["db"], released["driver"], released["run"]
    trip_id = today(loader_client, driver)[0]["id"]

    # The dispatcher publishes v2: one new outlet only.
    out40 = make_outlet(db, "OUT040")
    stop = make_stop(db, run, 1, 1, out40, plan_version=2)
    make_run_order(db, stop, released["orders"]["ORD1001"], state=RunOrderState.LOADED, plan_version=2)
    run.current_plan_version = 2
    db.flush()

    today(loader_client, driver)
    stops = trip_detail(loader_client, driver, trip_id)["stops"]
    assert [(s["sequence"], s["customer_name"]) for s in stops] == [(1, "Outlet OUT040")]


# ---- Start: the gate-out ---------------------------------------------------------

def test_start_is_the_gate_out(loader_client, released):
    db, run, orders = released["db"], released["run"], released["orders"]
    trip = today(loader_client, released["driver"])[0]

    body = start(loader_client, released["driver"], trip["id"])

    assert body["status"] == "started"
    db.refresh(run)
    assert run.status == RunStatus.GATED_OUT
    assert run.gated_out_at is not None
    # On the truck: on to dispatched. Flagged by the loader: not dispatched.
    for number in ("ORD1001", "ORD1002", "ORD1004"):
        db.refresh(orders[number])
        assert orders[number].status == OrderStatus.DISPATCHED, number
    db.refresh(orders[FLAGGED])
    assert orders[FLAGGED].status != OrderStatus.DISPATCHED

    dispatch_trip = db.get(DispatchTrip, released["dispatch_trip"].id)
    assert dispatch_trip.status == "en_route"
    assert dispatch_trip.driver_name == "Tharindu Fernando"
    assert dispatch_trip.stop_count == 3
    assert dispatch_trip.loading_events[-1]["event"] == "Left the gate"
    assert dispatch_trip.loading_events[-1]["status"] == "ok"


def test_starting_twice_returns_the_same_trip(loader_client, released):
    trip = today(loader_client, released["driver"])[0]
    first = start(loader_client, released["driver"], trip["id"])
    second = start(loader_client, released["driver"], trip["id"])
    assert first["started_at"] == second["started_at"]


def test_start_is_refused_while_the_run_is_back_at_the_dock(loader_client, released):
    db, run = released["db"], released["run"]
    trip = today(loader_client, released["driver"])[0]
    run.status = RunStatus.LOADING  # a late plan change reopened the checklist
    db.flush()

    res = loader_client.post(f"{API}/trips/{trip['id']}/start", headers=auth(released["driver"]))

    assert res.status_code == 409
    assert "still at the dock" in res.json()["detail"]


# ---- At the stop -------------------------------------------------------------------

def test_stop_detail_lists_every_order_at_the_stop(loader_client, released):
    trip = started_trip(loader_client, released)
    # OUT026 gets two orders (ORD1001 and ORD1004)
    stop = next(s for s in trip["stops"] if s["customer_name"] == "Outlet OUT026")

    res = loader_client.get(f"{API}/stops/{stop['id']}", headers=auth(released["driver"]))

    assert res.status_code == 200, res.text
    body = res.json()
    assert sorted(o["order_number"] for o in body["orders"]) == ["ORD1001", "ORD1004"]
    assert body["order"]["order_number"] == body["orders"][0]["order_number"]
    assert all(o["on_truck"] for o in body["orders"])


def test_stop_order_shows_the_loaders_temperature_and_the_outlet_window(loader_client, released):
    trip = started_trip(loader_client, released)
    stop = next(s for s in trip["stops"] if s["customer_name"] == "Outlet OUT027")

    order = loader_client.get(f"{API}/stops/{stop['id']}", headers=auth(released["driver"])).json()["order"]

    assert order["order_number"] == "ORD1002"
    assert order["temperature_zone"] == "Chilled"  # not the "Ambient" column default
    assert order["delivery_window"] == "02:30-08:00"


def test_flagged_order_shows_as_not_on_the_truck(loader_client, released):
    trip = started_trip(loader_client, released)
    stop = next(s for s in trip["stops"] if s["customer_name"] == "Outlet OUT030")

    body = loader_client.get(f"{API}/stops/{stop['id']}", headers=auth(released["driver"])).json()

    assert [(o["order_number"], o["on_truck"]) for o in body["orders"]] == [(FLAGGED, False)]


def test_delivering_a_stop_tells_the_store_and_the_dispatcher(loader_client, released):
    db, orders = released["db"], released["orders"]
    trip = started_trip(loader_client, released)
    stop = next(s for s in trip["stops"] if s["customer_name"] == "Outlet OUT026")

    deliver(loader_client, released["driver"], stop["id"])

    for number in ("ORD1001", "ORD1004"):
        db.refresh(orders[number])
        assert orders[number].status == OrderStatus.DELIVERED, number
    db.refresh(orders["ORD1002"])
    assert orders["ORD1002"].status == OrderStatus.DISPATCHED  # another stop
    delivered = db.execute(
        select(Notification).where(Notification.type == NotificationType.DELIVERED)
    ).scalars().all()
    assert len(delivered) == 2

    dispatch_trip = db.get(DispatchTrip, released["dispatch_trip"].id)
    assert dispatch_trip.stops_completed == 1
    assert dispatch_trip.loading_events[-1]["event"] == "Delivered"


def test_failed_stop_keeps_orders_dispatched_and_warns_the_dispatcher(loader_client, released):
    db, orders = released["db"], released["orders"]
    trip = started_trip(loader_client, released)
    stop = next(s for s in trip["stops"] if s["customer_name"] == "Outlet OUT027")
    driver = released["driver"]

    assert loader_client.patch(f"{API}/stops/{stop['id']}/arrive", headers=auth(driver)).status_code == 200
    res = loader_client.patch(f"{API}/stops/{stop['id']}/outcome", headers=auth(driver), json={"outcome": "failed"})

    assert res.status_code == 200, res.text
    db.refresh(orders["ORD1002"])
    assert orders["ORD1002"].status == OrderStatus.DISPATCHED
    event = db.get(DispatchTrip, released["dispatch_trip"].id).loading_events[-1]
    assert event["event"] == "Not delivered"
    assert event["status"] == "warning"


# ---- End of trip -----------------------------------------------------------------------

def test_completing_the_trip_closes_the_dispatchers_run(loader_client, released):
    db, driver = released["db"], released["driver"]
    trip = started_trip(loader_client, released)
    for stop in trip["stops"]:
        if stop["customer_name"] == "Outlet OUT030":
            loader_client.patch(f"{API}/stops/{stop['id']}/outcome", headers=auth(driver), json={"outcome": "failed"})
        else:
            deliver(loader_client, driver, stop["id"])

    res = loader_client.post(f"{API}/trips/{trip['id']}/complete", headers=auth(driver))

    assert res.status_code == 200, res.text
    dispatch_trip = db.get(DispatchTrip, released["dispatch_trip"].id)
    assert dispatch_trip.status == "completed"
    assert dispatch_trip.stops_completed == 3
    assert dispatch_trip.loading_events[-1]["note"] == "2 delivered · 0 partial · 1 not delivered"
    # Still on today's list, as finished
    assert [t["status"] for t in today(loader_client, driver)] == ["completed"]


def test_sync_replay_does_not_apply_twice(loader_client, released):
    trip = started_trip(loader_client, released)
    stop_id = trip["stops"][0]["id"]
    batch = [{
        "action_id": "a-1", "action_type": "arrive", "stop_id": stop_id,
        "payload": {}, "client_timestamp": "2026-10-03T03:40:00Z",
    }]

    first = loader_client.post(f"{API}/sync", headers=auth(released["driver"]), json=batch).json()
    arrived_at = trip_detail(loader_client, released["driver"], trip["id"])["stops"][0]["arrived_at"]
    second = loader_client.post(f"{API}/sync", headers=auth(released["driver"]), json=batch).json()

    assert first == {"processed_count": 1, "conflicts": []}
    assert second == {"processed_count": 1, "conflicts": []}
    assert trip_detail(loader_client, released["driver"], trip["id"])["stops"][0]["arrived_at"] == arrived_at


# ---- Trips not made from a loader run (seed data) still work -------------------------

def test_trip_without_a_run_starts_without_a_gate_out(loader_client, trip_setup):
    db = trip_setup["db"]
    driver, _ = make_driver(db)
    dispatch_trip = make_trip(db, trip_setup["vehicle"], [], code="RUN-0099")
    trip = DriverTrip(driver_id=driver.id, dispatch_trip_id=dispatch_trip.id)
    db.add(trip)
    db.flush()
    db.add(DeliveryStop(driver_trip_id=trip.id, sequence=1, address="12 Galle Rd", customer_name="Shop A"))
    db.flush()

    body = start(loader_client, driver, trip.id)

    assert body["status"] == "started"
    assert db.get(DispatchTrip, dispatch_trip.id).status == "en_route"
