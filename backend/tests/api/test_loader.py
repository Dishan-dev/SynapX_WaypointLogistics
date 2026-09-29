"""Loader API endpoints."""
import importlib

from app.models.delivery_run import RunStatus
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    build_run_021,
    loader_client,
    make_issue,
    make_loader,
)

BASE = "/api/v1/loader"


def test_get_run_returns_stops_in_load_order(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = loader_client.get(f"{BASE}/runs/RUN-021")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["code"] == "RUN-021"
    assert body["status"] == RunStatus.LOADING.value
    assert [stop["outlet"]["code"] for stop in body["stops"]] == [
        "OUT027", "OUT031", "OUT030", "OUT026",
    ]
    assert [stop["load_position"] for stop in body["stops"]] == [1, 2, 3, 4]


def test_get_run_exposes_the_capacity_the_design_shows(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    body = loader_client.get(f"{BASE}/runs/RUN-021").json()

    assert body["capacity"] == {
        "loaded_weight_kg": 3410.0,
        "planned_weight_kg": 4920.0,
        "max_weight_kg": 5510.0,
        "loaded_volume_m3": 16.6,
        "planned_volume_m3": 23.9,
        "max_volume_m3": 26.4,
    }
    assert (body["orders_checked"], body["orders_total"]) == (5, 8)


def test_get_run_includes_order_detail_for_the_checklist_rows(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    body = loader_client.get(f"{BASE}/runs/RUN-021").json()
    rows = {o["order_number"]: o for stop in body["stops"] for o in stop["orders"]}

    assert rows["ORD0092301"]["units"] == 56
    assert rows["ORD0092301"]["weight_kg"] == 820.0
    assert rows["ORD0092301"]["volume_m3"] == 4.0
    assert rows["ORD0092301"]["temperature_class"] == "ambient"
    assert rows["ORD0092301"]["state"] == "loaded"
    assert rows["ORD0092301"]["checked_by"] == "Saman J."
    assert rows["ORD0092302"]["temperature_class"] == "chilled"
    assert rows["ORD0092302"]["state"] == "to_load"
    assert rows["ORD0092302"]["checked_by"] is None


def test_get_run_404s_for_an_unknown_code(loader_client, db_session):
    response = loader_client.get(f"{BASE}/runs/RUN-999")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "NOT_FOUND"


def test_get_issue_returns_the_options_the_dispatcher_had(loader_client, db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)
    db_session.flush()

    response = loader_client.get(f"{BASE}/issues/{issue.id}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["order_number"] == "ORD0092308"
    assert body["issue_type"] == "missing"
    assert (body["units_affected"], body["units_total"]) == (8, 8)
    assert body["status"] == "sent"
    assert body["reported_by"] == "Tharindu J."
    assert [o["label"] for o in body["options"]] == [
        "Send without it", "Move to VEH036 · Trip 1", "Hold VEH035",
    ]
    assert [o["is_default"] for o in body["options"]] == [True, False, False]


def test_get_issue_404s_for_an_unknown_id(loader_client, db_session):
    response = loader_client.get(f"{BASE}/issues/4242")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "NOT_FOUND"


def test_dev_plan_change_publishes_the_next_version(loader_client, db_session):
    build_run_021(db_session)
    db_session.flush()

    response = loader_client.post(
        f"{BASE}/dev/runs/RUN-021/plan-change",
        json={
            "unload_order_numbers": ["ORD0092308"],
            "dont_load_order_numbers": ["ORD0092304"],
            "load_new_order_numbers": ["ORD0092319"],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan_version"] == 3
    assert {c["change_kind"]: c["order_number"] for c in body["changes"]} == {
        "unload_from_truck": "ORD0092308",
        "dont_load": "ORD0092304",
        "load_new": "ORD0092319",
    }

    after = loader_client.get(f"{BASE}/runs/RUN-021").json()
    assert after["current_plan_version"] == 3
    assert after["unacknowledged_plan_version"] == 3
    assert after["capacity"]["planned_weight_kg"] == 4690.0
    assert after["capacity"]["planned_volume_m3"] == 22.6
    assert after["orders_total"] == 7


def test_dev_plan_change_defaults_to_the_figma_change(loader_client, db_session):
    """Posting no body reproduces the design's v2 -> v3 change."""
    build_run_021(db_session)
    db_session.flush()

    response = loader_client.post(f"{BASE}/dev/runs/RUN-021/plan-change")

    assert response.status_code == 200, response.text
    assert {c["change_kind"] for c in response.json()["changes"]} == {
        "unload_from_truck", "dont_load", "load_new",
    }
    after = loader_client.get(f"{BASE}/runs/RUN-021").json()
    assert after["capacity"]["planned_weight_kg"] == 4690.0


def test_dev_decision_then_activity_is_logged(loader_client, db_session):
    run, orders = build_run_021(db_session)
    run.status = RunStatus.ISSUE_FLAGGED
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)
    db_session.flush()

    decided = loader_client.post(
        f"{BASE}/dev/issues/{issue.id}/decide",
        json={"option_label": "Move to VEH036 · Trip 1", "decided_by": "Kasun Perera"},
    )
    assert decided.status_code == 200, decided.text

    detail = loader_client.get(f"{BASE}/issues/{issue.id}").json()
    assert detail["status"] == "decided"
    assert detail["decided_by"] == "Kasun Perera"

    activity = loader_client.get(f"{BASE}/runs/RUN-021/activity").json()
    assert any(entry["event_type"] == "issue_decided" for entry in activity)
    assert any(entry["actor_kind"] == "dispatcher" for entry in activity)


def test_dev_expire_applies_the_default(loader_client, db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)
    db_session.flush()

    response = loader_client.post(f"{BASE}/dev/issues/{issue.id}/expire")

    assert response.status_code == 200, response.text
    detail = loader_client.get(f"{BASE}/issues/{issue.id}").json()
    assert detail["status"] == "default_applied"
    chosen = [o["label"] for o in detail["options"] if o["is_chosen"]]
    assert chosen == ["Send without it"]


def test_resolving_a_settled_issue_returns_409(loader_client, db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)
    db_session.flush()
    loader_client.post(f"{BASE}/dev/issues/{issue.id}/expire")

    response = loader_client.post(f"{BASE}/dev/issues/{issue.id}/expire")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "INVALID_STATE_TRANSITION"


def test_dev_endpoints_are_not_mounted_in_production(monkeypatch):
    """The sub-router is not registered at all, so the paths never exist."""
    from app.core import config

    monkeypatch.setattr(config.settings, "ENVIRONMENT", "production")

    from app.api.v1.endpoints import loader as loader_endpoints

    reloaded = importlib.reload(loader_endpoints)
    try:
        dev_paths = [
            route.path for route in reloaded.router.routes if "/dev/" in route.path
        ]
        read_paths = [
            route.path for route in reloaded.router.routes if "/dev/" not in route.path
        ]
        assert dev_paths == []
        # The ordinary reads are untouched.
        assert len(read_paths) == 3
    finally:
        # Restore the module for the rest of the session.
        monkeypatch.undo()
        importlib.reload(loader_endpoints)


def test_sanduni_endpoints_are_not_implemented_here(loader_client, db_session):
    """L2/L3/L5 belong to the other loader branch; L0 must not squat on them."""
    build_run_021(db_session)
    db_session.flush()

    for path in ("/users", "/summary", "/runs", "/issues"):
        response = loader_client.get(f"{BASE}{path}")
        assert response.status_code == 404, f"{path} unexpectedly served: {response.text}"
