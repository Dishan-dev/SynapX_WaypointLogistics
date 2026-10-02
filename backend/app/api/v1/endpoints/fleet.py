from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.fleet import Vehicle, DriverProfile
from app.schemas.fleet import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    DriverProfileCreate,
    DriverProfileResponse,
)

router = APIRouter()

@router.get("/vehicles", response_model=List[VehicleResponse])
def get_vehicles(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve vehicles. Optionally filter by status.
    """
    query = db.query(Vehicle)
    if status:
        query = query.filter(Vehicle.status == status.upper())
    vehicles = query.offset(skip).limit(limit).all()
    return vehicles

@router.post("/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db)
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

@router.put("/vehicles/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update an existing vehicle.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = vehicle_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)
        
    db.commit()
    db.refresh(vehicle)
    return vehicle

@router.patch("/vehicles/{vehicle_id}/status", response_model=VehicleResponse)
def update_vehicle_status(
    vehicle_id: int,
    status: str,
    db: Session = Depends(get_db)
) -> Any:
    """
    Quick status toggle/update for vehicle.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle.status = status.upper()
    db.commit()
    db.refresh(vehicle)
    return vehicle

@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db)
) -> None:
    """
    Remove vehicle from fleet.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db.delete(vehicle)
    db.commit()
    return None

@router.get("/drivers", response_model=List[DriverProfileResponse])
def get_drivers(
    db: Session = Depends(get_db),
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
