from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.delivery_issue import DeliveryIssueCreate, DeliveryIssueRead, DeliveryIssueUpdate
from app.services.issue_service import issue_service

router = APIRouter()


@router.get("", response_model=List[DeliveryIssueRead])
def list_issues(
    outlet_id: Optional[int] = Query(None, description="Filter by outlet ID"),
    status: Optional[str] = Query(None, description="Filter by status (open, under_review, resolved, credit_issued)"),
    search: Optional[str] = Query(None, description="Search in title, sku, description"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List delivery issues and exceptions for store manager or central dispatch."""
    return issue_service.get_issues(db, outlet_id=outlet_id, status=status, search=search, limit=limit)


@router.get("/{issue_id}", response_model=DeliveryIssueRead)
def get_issue(
    issue_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific issue by ID."""
    return issue_service.get_issue(db, issue_id)


@router.post("", response_model=DeliveryIssueRead, status_code=201)
def create_issue(
    payload: DeliveryIssueCreate,
    db: Session = Depends(get_db),
):
    """Log a new discrepancy, damage report, or delivery exception."""
    return issue_service.create_issue(db, payload)


@router.patch("/{issue_id}", response_model=DeliveryIssueRead)
def update_issue(
    issue_id: int,
    payload: DeliveryIssueUpdate,
    db: Session = Depends(get_db),
):
    """Update issue status, resolution notes, or claim amount."""
    return issue_service.update_issue(db, issue_id, payload)
