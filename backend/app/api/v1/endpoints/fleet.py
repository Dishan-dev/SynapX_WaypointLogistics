from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from datetime import timezone

from app.api.deps import get_db, require_dispatcher_or_admin
from app.models.user import User
from app.models.fleet import Vehicle, DriverProfile, VehicleStatus
from app.models.allocation import Allocation, AllocationStatus
from app.schemas.fleet import VehicleCreate, VehicleUpdate, VehicleResponse, DriverProfileCreate, DriverProfileResponse

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
    db: Session = Depends(get_db),
    _: User = Depends(require_dispatcher_or_admin),
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This vehicle code is already in use.")
    db.refresh(vehicle)
    return vehicle


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_dispatcher_or_admin),
) -> Any:
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).with_for_update().first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    def utc_naive(value):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
    if utc_naive(vehicle.updated_at) != utc_naive(vehicle_in.expected_updated_at):
        raise HTTPException(status_code=409, detail="Vehicle changed since you opened it. Close the form, refresh, and try again.")
    changes = vehicle_in.model_dump(exclude_unset=True, exclude={"expected_updated_at"})
    changes = {key: value for key, value in changes.items() if getattr(vehicle, key) != value}
    protected = {"status", "code", "vehicle_type", "capacity_kg", "capacity_vol_m3", "temperature_mode", "depot_name"}
    if protected.intersection(changes):
        active = db.query(Allocation.id).filter(Allocation.vehicle_id == vehicle_id, Allocation.status.notin_([AllocationStatus.COMPLETED, AllocationStatus.CANCELLED])).first()
        if active or vehicle.status in (VehicleStatus.ALLOCATED, VehicleStatus.LOADING):
            raise HTTPException(status_code=409, detail="This vehicle is assigned to operational work. Complete or cancel its allocation before changing specifications or availability.")
    if "code" in changes and db.query(Vehicle.id).filter(Vehicle.code == changes["code"], Vehicle.id != vehicle_id).first():
        raise HTTPException(status_code=409, detail="This vehicle code is already in use.")
    for key, value in changes.items():
        setattr(vehicle, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="The vehicle could not be saved because its code conflicts with another vehicle.")
    db.refresh(vehicle)
    return vehicle

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
