from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.allocation import Allocation
from app.models.fleet import DriverProfile
from app.schemas.allocation import AllocationCreate, AllocationResponse

router = APIRouter()

@router.get("/", response_model=List[AllocationResponse])
def get_allocations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve allocations with their nested vehicles and drivers.
    """
    allocations = (
        db.query(Allocation)
        .options(
            joinedload(Allocation.vehicle), 
            joinedload(Allocation.driver).joinedload(DriverProfile.user)
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return allocations

@router.post("/", response_model=AllocationResponse, status_code=status.HTTP_201_CREATED)
def create_allocation(
    allocation_in: AllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create new allocation.
    """
    allocation = Allocation(**allocation_in.model_dump())
    db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return allocation
