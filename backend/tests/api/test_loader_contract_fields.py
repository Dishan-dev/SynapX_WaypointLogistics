"""Fields Sanduni's screens need on the run read, and the helpers her L3/L6
endpoints call (API_CONTRACT.md)."""
from app.models.delivery_run import RunStatus
from app.schemas.loader import SimulatedPlanChangeRequest
from app.services.loader_service import LoaderService
from tests.conftest_loader import (  # noqa: F401  (loader_client is a fixture)
    at,
    build_run_021,
    loader_client,
    make_loader,
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
