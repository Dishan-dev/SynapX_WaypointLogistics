from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.fleet import Vehicle, DriverProfile
from app.schemas.fleet import VehicleCreate, VehicleResponse, DriverProfileCreate, DriverProfileResponse

router = APIRouter()

@router.get("/vehicles", response_model=List[VehicleResponse])
def get_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve vehicles.
    """
    vehicles = db.query(Vehicle).offset(skip).limit(limit).all()
    return vehicles

@router.post("/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create new vehicle.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.code == vehicle_in.code).first()
    if vehicle:
        raise HTTPException(
            status_code=400,
            detail="The vehicle with this code already exists in the system.",
        )
    vehicle = Vehicle(**vehicle_in.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle

@router.get("/drivers", response_model=List[DriverProfileResponse])
def get_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve drivers.
    """
    drivers = (
        db.query(DriverProfile)
        .options(joinedload(DriverProfile.user))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return drivers
