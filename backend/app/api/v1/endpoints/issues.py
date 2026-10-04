from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.delivery_issue import DeliveryIssue
from app.schemas.delivery_issue import DeliveryIssueRead, DeliveryIssueUpdate

router = APIRouter()

@router.get("", response_model=List[DeliveryIssueRead])
def get_issues(
    db: Session = Depends(get_db),
    outlet_id: Optional[int] = Query(None, description="Filter by outlet ID"),
    status: Optional[str] = Query(None, description="Filter by status (e.g. 'open', 'resolved')")
):
    query = db.query(DeliveryIssue)
    if outlet_id is not None:
        query = query.filter(DeliveryIssue.outlet_id == outlet_id)
    if status is not None:
        query = query.filter(DeliveryIssue.status == status)
    
    return query.order_by(DeliveryIssue.reported_at.desc()).all()

@router.patch("/{issue_id}", response_model=DeliveryIssueRead)
def update_issue(
    issue_id: int,
    issue_in: DeliveryIssueUpdate,
    db: Session = Depends(get_db)
):
    issue = db.query(DeliveryIssue).filter(DeliveryIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    update_data = issue_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(issue, field, value)
        
    db.commit()
    db.refresh(issue)
    return issue
