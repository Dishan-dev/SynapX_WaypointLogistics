from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api import deps
from app.models.shipment import DispatchTrip
from app.schemas.shipment import DispatchTripCreate, DispatchTripRead

router = APIRouter()


@router.get("/trips", response_model=List[DispatchTripRead])
def list_trips(skip: int = 0, limit: int = 50, db: Session = Depends(deps.get_db)):
    return db.query(DispatchTrip).offset(skip).limit(limit).all()


@router.post("/trips", response_model=DispatchTripRead, status_code=status.HTTP_201_CREATED)
def create_trip(trip_in: DispatchTripCreate, db: Session = Depends(deps.get_db)):
    trip = DispatchTrip(**trip_in.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip
