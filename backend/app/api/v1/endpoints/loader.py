"""Loader endpoints.

Scope: L4 (checklist read, and check / uncheck / recheck), L7 (acknowledge a
plan change, unload a take-off order), the reads for L8
(decision) and L9 (activity, per-run and dock-wide), plus the dev-only
simulation endpoints from L0.

The queue, sign-in and issue-list endpoints (L2/L3/L5) are Sanduni's features.
Their proposed response shapes are written up in docs/loader/API_CONTRACT.md
rather than implemented here.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.loader_activity import CheckAction
from app.schemas import loader as schemas
from app.services.loader_service import loader_service

router = APIRouter()


@router.get("/runs/{code}", response_model=schemas.RunDetailRead)
def get_run(code: str, db: Session = Depends(deps.get_db)):
    """The loading checklist for one run, stops in load order (deepest first)."""
    run = loader_service.get_run(db, code)
    return loader_service.build_run_detail(db, run)


@router.get("/runs/{code}/activity", response_model=List[schemas.ActivityRead])
def get_run_activity(code: str, db: Session = Depends(deps.get_db)):
    """One run's timeline, OLDEST first - the checklist's Change log panel.

    Chronological because the panel reads top to bottom as the shift progresses.
    For the dock-wide feed, see GET /loader/activity.
    """
    run = loader_service.get_run(db, code)
    return loader_service.list_activity(db, run)


@router.get("/activity", response_model=List[schemas.ActivityRead])
def get_dock_activity(
    dock: str = Query(..., description="Dock number, code or name: 3, DOCK3 or 'Dock 3'"),
    run_code: str | None = Query(None, description="Narrow the feed to one run"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(deps.get_db),
):
    """Everything that happened at one dock, NEWEST first - the Log tab.

    Deliberately the opposite order to the per-run timeline: this is a feed, and
    a loader returning to the Log tab wants the most recent entry at the top,
    across every run on the dock.
    """
    resolved = loader_service.resolve_dock(db, dock)
    return loader_service.list_dock_activity(db, resolved, run_code=run_code, limit=limit)


# ---------------------------------------------------------------------------
# L4 writes - check, uncheck and re-check one checklist row
#
# Every body carries client_action_id (a replay returns the run with 200 and
# applies nothing) and plan_version (a stale one is refused with 409
# PLAN_VERSION_STALE). A replay answers with the run's CURRENT state: the
# original response is not stored. Uncheck is DELETE on the check resource,
# with a JSON body, because that is what the tablet's offline outbox sends.
# ---------------------------------------------------------------------------

ORDER_PATH = "/runs/{code}/orders/{order_number}"


def _order_action(
    db: Session,
    code: str,
    order_number: str,
    action: CheckAction,
    payload: schemas.OrderActionRequest,
) -> schemas.RunDetailRead:
    run = loader_service.apply_order_action(db, code, order_number, action, payload)
    db.commit()
    return loader_service.build_run_detail(db, run)


@router.post(f"{ORDER_PATH}/check", response_model=schemas.RunDetailRead)
def check_order(
    code: str,
    order_number: str,
    payload: schemas.OrderActionRequest,
    db: Session = Depends(deps.get_db),
):
    """Tick an order as loaded (to_load, new or re_check -> loaded)."""
    return _order_action(db, code, order_number, CheckAction.CHECK, payload)


@router.delete(f"{ORDER_PATH}/check", response_model=schemas.RunDetailRead)
def uncheck_order(
    code: str,
    order_number: str,
    payload: schemas.OrderActionRequest,
    db: Session = Depends(deps.get_db),
):
    """Untick an order (loaded -> to_load, or -> new if this plan added it)."""
    return _order_action(db, code, order_number, CheckAction.UNCHECK, payload)


@router.post(f"{ORDER_PATH}/recheck", response_model=schemas.RunDetailRead)
def recheck_order(
    code: str,
    order_number: str,
    payload: schemas.OrderActionRequest,
    db: Session = Depends(deps.get_db),
):
    """Confirm an order a plan change put back to re_check (re_check -> loaded)."""
    return _order_action(db, code, order_number, CheckAction.RECHECK, payload)


# ---------------------------------------------------------------------------
# L7 writes - acknowledge a plan change, unload a take-off order
# ---------------------------------------------------------------------------


@router.post(f"{ORDER_PATH}/unload", response_model=schemas.RunDetailRead)
def unload_order(
    code: str,
    order_number: str,
    payload: schemas.OrderActionRequest,
    db: Session = Depends(deps.get_db),
):
    """The loader took a plan-removed order back off the truck (take_off -> moved).

    Same body, replay and stale-plan rules as check.
    """
    return _order_action(db, code, order_number, CheckAction.UNLOAD, payload)


@router.post("/runs/{code}/plan/{version}/acknowledge", response_model=schemas.RunDetailRead)
def acknowledge_plan(
    code: str,
    version: int,
    payload: schemas.AcknowledgePlanRequest,
    db: Session = Depends(deps.get_db),
):
    """The loader has read the plan-change diff; unblocks the checklist.

    Acknowledging the latest version also acknowledges any unread version
    before it, so stacked changes are confirmed once.
    """
    if payload.plan_version != version:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "PLAN_VERSION_MISMATCH",
                "message": f"Body plan_version {payload.plan_version} does not match v{version} in the path.",
            },
        )
    run = loader_service.acknowledge_plan(db, code, version, payload)
    db.commit()
    return loader_service.build_run_detail(db, run)


@router.get("/issues/{issue_id}", response_model=schemas.IssueDetailRead)
def get_issue(issue_id: int, db: Session = Depends(deps.get_db)):
    """One flagged issue with the options the dispatcher had."""
    issue = loader_service.get_issue(db, issue_id)
    return loader_service.build_issue_detail(db, issue)


# ---------------------------------------------------------------------------
# Dev-only simulation
#
# There is no dispatcher UI yet, so these stand in for the dispatcher acting on a
# run. The sub-router is only mounted when LOADER_DEV_ENDPOINTS is on and the
# environment is not production - not merely guarded inside the handlers - so in
# production the paths 404 and never appear in the OpenAPI schema at all.
# ---------------------------------------------------------------------------

dev_router = APIRouter(prefix="/dev", tags=["Loader · dev only"])

# The Figma v2 -> v3 change on RUN-021, used when the request body is empty.
FIGMA_PLAN_CHANGE = schemas.SimulatedPlanChangeRequest(
    unload_order_numbers=["ORD0092308"],
    dont_load_order_numbers=["ORD0092304"],
    load_new_order_numbers=["ORD0092319"],
    summary="Cold-room fault at OUT027; OUT028 must go tonight.",
)


@dev_router.post("/runs/{code}/plan-change", response_model=schemas.SimulationResult)
def simulate_plan_change(
    code: str,
    payload: schemas.SimulatedPlanChangeRequest | None = None,
    db: Session = Depends(deps.get_db),
):
    """Publish the next plan version, as the dispatcher would.

    With no body this reproduces the Figma v2 -> v3 change exactly.
    """
    run = loader_service.get_run(db, code)
    if payload is None or not any(
        [
            payload.unload_order_numbers,
            payload.dont_load_order_numbers,
            payload.load_new_order_numbers,
        ]
    ):
        payload = FIGMA_PLAN_CHANGE

    revision = loader_service.simulate_plan_change(db, run, payload)
    db.commit()
    return schemas.SimulationResult(
        detail=f"Published plan v{revision.version} for {run.code}.",
        run_code=run.code,
        plan_version=revision.version,
        changes=[
            schemas.PlanChangeRead(
                change_kind=change.change_kind,
                order_number=change.order.order_number if change.order else None,
                outlet_code=change.outlet.code if change.outlet else None,
                reason=change.reason,
            )
            for change in revision.changes
        ],
    )


@dev_router.post("/issues/{issue_id}/decide", response_model=schemas.SimulationResult)
def simulate_decision(
    issue_id: int,
    payload: schemas.SimulatedDecisionRequest | None = None,
    db: Session = Depends(deps.get_db),
):
    """Apply a dispatcher decision. With no option named, the default is used."""
    issue = loader_service.get_issue(db, issue_id)
    issue = loader_service.simulate_decision(
        db, issue, payload or schemas.SimulatedDecisionRequest()
    )
    db.commit()
    chosen = next((o.label for o in issue.options if o.is_chosen), None)
    return schemas.SimulationResult(
        detail=f"Dispatcher decided: {chosen}.",
        run_code=issue.run.code,
        issue_id=issue.id,
    )


@dev_router.post("/issues/{issue_id}/expire", response_model=schemas.SimulationResult)
def simulate_decision_timeout(issue_id: int, db: Session = Depends(deps.get_db)):
    """Let decide-by pass so the pre-agreed default is applied instead."""
    issue = loader_service.get_issue(db, issue_id)
    issue = loader_service.simulate_decision_timeout(db, issue)
    db.commit()
    chosen = next((o.label for o in issue.options if o.is_chosen), None)
    return schemas.SimulationResult(
        detail=f"Decide-by passed; applied default: {chosen}.",
        run_code=issue.run.code,
        issue_id=issue.id,
    )


if settings.LOADER_DEV_ENDPOINTS and settings.ENVIRONMENT != "production":
    router.include_router(dev_router)
