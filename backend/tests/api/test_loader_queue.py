"""L3: GET /loader/runs?dock= (the queue) and GET /loader/summary?dock=.

Test times go through conftest's at(), which stores naive UTC: at("21:40") on
2026-05-28 is 03:10 depot time on Fri 29 May.
"""
from datetime import date, timedelta

from app.models.delivery_run import RunStatus
from app.models.loader_activity import ActorKind
from app.models.reference import Brand, CalendarDay, DockType, TempCapability, VehicleType
from app.schemas.loader import SimulatedPlanChangeRequest
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    at,
    build_run_021,
    loader_client,
    make_dock,
    make_issue,
    make_loader,
    make_order,
    make_outlet,
    make_revision,
    make_run,
    make_run_order,
    make_stop,
    make_vehicle,
)

BASE = "/api/v1/loader"


def queue(client, dock="Dock 3", **params):
    return client.get(f"{BASE}/runs", params={"dock": dock, **params})


def summary(client, dock="Dock 3"):
    return client.get(f"{BASE}/summary", params={"dock": dock})


def cards(body):
    return {card["code"]: card for group in body["groups"] for card in group["runs"]}


def other_run(db, dock, code, departs, brand=Brand.FRESH, wave="night", status=RunStatus.NOT_STARTED,
              vehicle=None, trip_number=1):
    vehicle = vehicle or make_vehicle(db, code=f"V-{code}")
    run = make_run(db, vehicle, dock, code=code, status=status, plan_version=1, departs=departs)
    run.brand, run.wave, run.trip_number = brand, wave, trip_number
    db.flush()
    return run


# --- GET /loader/runs ------------------------------------------------------------


def test_cards_match_the_run_read_they_open(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    card = cards(queue(loader_client).json())["RUN-021"]
    detail = loader_client.get(f"{BASE}/runs/RUN-021").json()

    assert card["stop_count"] == len(detail["stops"]) == 4
    for field in ("orders_loaded", "orders_checked", "orders_total", "status", "departs_at"):
        assert card[field] == detail[field]
    assert (card["vehicle_code"], card["vehicle_type"], card["temp_capability"]) == ("VEH001", "truck", "reefer")
    assert card["chips"] == ["Truck", "Reefer", "5,510 kg · 26.4 m³"]
    assert card["loader"] == "Saman J."  # who checked last; nothing logged yet
    assert card["plan_updated_at"] == "2026-05-28T21:40:00Z"
    assert (card["released_at"], card["released_by"], card["pre_stage_note"], card["alert"]) == (None, None, None, None)


def test_groups_by_brand_and_wave_in_departure_order(loader_client, db_session):
    run, _ = build_run_021(db_session)  # fresh, night, 03:30
    dock = run.dock
    other_run(db_session, dock, "RUN-031", "06:00", brand=Brand.STYLE, wave="day")
    other_run(db_session, dock, "RUN-029", "05:20")
    other_run(db_session, dock, "RUN-033", "06:30", brand=Brand.TECH, wave="day")
    other_run(db_session, dock, "RUN-020", "01:00", status=RunStatus.GATED_OUT)
    other_run(db_session, make_dock(db_session, "DOCK4", "Dock 4"), "RUN-040", "02:00")
    db_session.flush()

    body = queue(loader_client).json()

    assert [(g["label"], g["brand"], g["wave"]) for g in body["groups"]] == [
        ("Fresh · night wave", "fresh", "night"),
        ("Style · day wave", "style", "day"),
        ("Tech · day wave", "tech", "day"),
    ]
    assert [c["code"] for c in body["groups"][0]["runs"]] == ["RUN-021", "RUN-029"]
    assert "RUN-020" not in cards(body)  # gated out: the driver's now
    assert "RUN-040" not in cards(body)  # another dock


def test_brand_filters_and_dock_accepts_number_code_or_name(loader_client, db_session):
    run, _ = build_run_021(db_session)
    other_run(db_session, run.dock, "RUN-031", "06:00", brand=Brand.STYLE, wave="day")
    db_session.flush()

    assert list(cards(queue(loader_client, brand="style").json())) == ["RUN-031"]
    for dock in ("3", "DOCK3", "Dock 3"):
        assert set(cards(queue(loader_client, dock=dock).json())) == {"RUN-021", "RUN-031"}


def test_an_unread_plan_puts_the_plan_change_alert_on_the_card(loader_client, db_session):
    run, _ = build_run_021(db_session)
    LoaderService.simulate_plan_change(
        db_session, run, SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )
    db_session.flush()
    published = LoaderService.plan_updated_at(db_session, run)

    alert = cards(queue(loader_client).json())["RUN-021"]["alert"]

    hhmm = (published.replace(tzinfo=None) + timedelta(hours=5, minutes=30)).strftime("%H:%M")  # depot time
    assert alert == {
        "tone": "warning",
        "message": f"Plan updated {hhmm} · v2 → v3",
        "action": "Review",
        "href": "/loader/runs/RUN-021",
    }


def test_a_plan_after_ready_says_the_load_reopened(loader_client, db_session):
    run, _ = build_run_021(db_session)
    run.status = RunStatus.READY_TO_DEPART
    run.released_at = at("01:48")
    LoaderService.simulate_plan_change(
        db_session, run, SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )
    db_session.flush()

    alert = cards(queue(loader_client).json())["RUN-021"]["alert"]

    assert alert["tone"] == "error"
    assert alert["message"].startswith("Load reopened · RUN-021 · VEH001 · v2 → v3 at ")


def test_a_waiting_flag_puts_an_issue_alert_on_the_card(loader_client, db_session):
    run, orders = build_run_021(db_session)
    tharindu = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092304"], tharindu)
    LoaderService.log(
        db_session, run, at=at("02:03"), actor_kind=ActorKind.LOADER, actor_id=tharindu.id,
        event_type="issue_flagged", message="ORD0092304: missing 8 of 8 units, sent to Dispatcher",
    )
    run.status = RunStatus.ISSUE_FLAGGED
    db_session.flush()

    card = cards(queue(loader_client).json())["RUN-021"]

    assert card["alert"] == {
        "tone": "error",
        "message": "ORD0092304 missing · waiting",
        "action": "Open",
        "href": f"/loader/issues/{issue.id}",
    }
    assert card["loader"] == "Tharindu J."  # the latest loader action beats the last check


def test_a_signed_off_run_says_so_and_who_released_it(loader_client, db_session):
    run, _ = build_run_021(db_session)
    nimal = make_loader(db_session, "Nimal Senanayake", "Nimal S.")
    run.status = RunStatus.READY_TO_DEPART
    run.released_at, run.released_by_id = at("01:48"), nimal.id
    db_session.flush()

    card = cards(queue(loader_client).json())["RUN-021"]

    assert card["alert"] == {
        "tone": "success",
        "message": "Signed off · driver can collect",
        "action": "View",
        "href": "/loader/runs/RUN-021/ready",
    }
    assert card["released_by"] == {"id": nimal.id, "name": "Nimal S."}
    assert card["released_at"] == "2026-05-28T01:48:00Z"


def test_the_third_chip_is_van_only_then_reload_then_capacity(loader_client, db_session):
    dock = make_dock(db_session)
    van = make_vehicle(db_session, "VEH035", VehicleType.VAN, TempCapability.REEFER, 1500.0, 9.0)
    van_run = other_run(db_session, dock, "RUN-027", "04:30", vehicle=van)
    outlet = make_outlet(db_session, "OUT003", DockType.STREET, van_only=True)
    stop = make_stop(db_session, van_run, 1, 1, outlet, plan_version=1)
    make_run_order(db_session, stop, make_order(db_session, "ORD0092314", outlet), plan_version=1)
    ambient = make_vehicle(db_session, "VEH012", VehicleType.TRUCK, TempCapability.AMBIENT, 3200.0, 18.0)
    other_run(db_session, dock, "RUN-029", "05:20", vehicle=ambient, trip_number=2)
    db_session.flush()

    body = cards(queue(loader_client).json())

    assert body["RUN-027"]["chips"] == ["Van", "Reefer", "van_only"]
    assert body["RUN-029"]["chips"] == ["Truck", "Ambient", "2nd trip · reload"]
    assert body["RUN-029"]["stop_count"] == 0 and body["RUN-029"]["orders_total"] == 0


def test_the_queue_needs_a_known_dock(loader_client, db_session):
    make_dock(db_session)
    db_session.flush()

    assert loader_client.get(f"{BASE}/runs").status_code == 422
    missing = queue(loader_client, dock="9")
    assert missing.status_code == 404
    assert missing.json()["detail"]["entity"] == "Dock"


# --- GET /loader/summary -----------------------------------------------------------


def test_summary_counts_the_same_runs_as_the_queue(loader_client, db_session):
    run, orders = build_run_021(db_session)  # loading, Saman J.
    dock = run.dock
    tharindu = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    flagged = other_run(db_session, dock, "RUN-027", "04:30", status=RunStatus.ISSUE_FLAGGED)
    make_issue(db_session, flagged, orders["ORD0092304"], tharindu)
    LoaderService.log(
        db_session, flagged, at=at("02:03"), actor_kind=ActorKind.LOADER, actor_id=tharindu.id,
        event_type="issue_flagged", message="flagged",
    )
    other_run(db_session, dock, "RUN-022", "03:40", status=RunStatus.READY_TO_DEPART)
    other_run(db_session, dock, "RUN-031", "06:00", brand=Brand.STYLE, wave="day")
    other_run(db_session, dock, "RUN-020", "01:00", status=RunStatus.GATED_OUT)
    db_session.add_all([
        CalendarDay(date=date(2026, 5, 28), holiday_name=None),
        CalendarDay(date=date(2026, 5, 30), holiday_name="Poson"),
    ])
    db_session.flush()

    response = summary(loader_client)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {
        "dock": "Dock 3",
        "date": "2026-05-28",  # 03:30 UTC departure is 09:00 depot time the same day
        "day_label": "Thu 28 May",
        "next_holiday": {"date": "2026-05-30", "label": "Poson Sat 30 May"},
        "runs": 4,
        "loading": {"count": 2, "loaders": ["Saman", "Tharindu"]},
        "issues": {"count": 1, "label": "Awaiting decision"},
        "ready": {"count": 1, "run_codes": ["RUN-022"]},
        "plan_updated_at": "2026-05-28T21:40:00Z",
    }


def test_summary_of_an_empty_dock(loader_client, db_session):
    make_dock(db_session)
    db_session.flush()

    body = summary(loader_client).json()

    assert body["runs"] == 0
    assert body["issues"] == {"count": 0, "label": "None waiting"}
    assert body["loading"] == {"count": 0, "loaders": []}
    assert body["ready"] == {"count": 0, "run_codes": []}
    assert body["plan_updated_at"] is None


def test_summary_needs_a_known_dock(loader_client, db_session):
    assert loader_client.get(f"{BASE}/summary").status_code == 422
    assert summary(loader_client, dock="9").status_code == 404
