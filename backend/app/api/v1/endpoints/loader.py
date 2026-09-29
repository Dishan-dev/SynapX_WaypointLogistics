"""Loader endpoints.

Scope: only the reads belonging to L4 (checklist), L8 (decision) and L9
(activity), plus the dev-only simulation endpoints from L0.

The queue, sign-in and issue-list endpoints (L2/L3/L5) are Sanduni's features.
Their proposed response shapes are written up in docs/loader/API_CONTRACT.md
rather than implemented here.
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
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
    """The run's timeline, oldest first - the Log tab and the Change log panel."""
    run = loader_service.get_run(db, code)
    return loader_service.list_activity(db, run)


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
