import csv
import io
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from datetime import timezone

from app.api.deps import get_db, require_dispatcher_or_admin
from app.models.user import User
from app.models.fleet import Vehicle, DriverProfile, VehicleStatus
from app.schemas.fleet import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    DriverProfileCreate,
    DriverProfileResponse,
)
from app.models.allocation import Allocation, AllocationStatus

router = APIRouter()

class VehicleCSVImportRequest(BaseModel):
    csv_content: str

@router.get("/vehicles/export-csv")
def export_vehicles_csv(
    db: Session = Depends(get_db)
) -> Any:
    """
    Export all vehicles as a CSV matching standard fleet specification:
    vehicle_id,type,temp,weight_cap_kg,volume_cap_m3,fuel_type,km_per_l,weekly_fuel_quota_l,depot
    """
    vehicles = db.query(Vehicle).order_by(Vehicle.code.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "vehicle_id",
        "type",
        "temp",
        "weight_cap_kg",
        "volume_cap_m3",
        "fuel_type",
        "km_per_l",
        "weekly_fuel_quota_l",
        "depot"
    ])
    for v in vehicles:
        depot_disp = (v.depot_name or "Peliyagoda").strip().capitalize()
        weight_str = f"{int(v.capacity_kg)}" if (v.capacity_kg and float(v.capacity_kg).is_integer()) else f"{v.capacity_kg}"
        vol_str = f"{v.capacity_vol_m3:.1f}" if v.capacity_vol_m3 is not None else "0.0"
        quota_str = f"{int(v.weekly_fuel_quota_l)}" if (v.weekly_fuel_quota_l and float(v.weekly_fuel_quota_l).is_integer()) else f"{v.weekly_fuel_quota_l or 500}"
        km_l_str = f"{v.km_per_l:.1f}" if v.km_per_l is not None else "6.0"

        writer.writerow([
            v.code,
            v.vehicle_type,
            v.temperature_mode,
            weight_str,
            vol_str,
            v.fuel_type or "diesel",
            km_l_str,
            quota_str,
            depot_disp
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=waypoint_vehicles.csv"}
    )

@router.post("/vehicles/import-csv")
def import_vehicles_csv(
    payload: VehicleCSVImportRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Import or bulk update vehicles via CSV string.
    Supported headers:
    vehicle_id, type, temp, weight_cap_kg, volume_cap_m3, fuel_type, km_per_l, weekly_fuel_quota_l, depot
    """
    raw_content = payload.csv_content.strip()
    if not raw_content:
        raise HTTPException(status_code=400, detail="CSV content is empty")

    stream = io.StringIO(raw_content)
    reader = csv.DictReader(stream)

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Invalid CSV format: no headers found")

    imported_count = 0
    updated_count = 0
    errors = []

    for row_idx, row in enumerate(reader, start=2):
        try:
            norm_row = {str(k).strip().lower(): (str(v).strip() if v else "") for k, v in row.items() if k}
            
            code = norm_row.get("vehicle_id") or norm_row.get("code") or norm_row.get("id")
            if not code:
                errors.append(f"Row {row_idx}: Missing vehicle_id/code")
                continue
            code = code.upper()

            v_type = norm_row.get("type") or norm_row.get("vehicle_type") or "truck"
            v_type = v_type.lower()
            if v_type not in ["truck", "van"]:
                v_type = "truck" if "truck" in v_type else "van"

            temp = norm_row.get("temp") or norm_row.get("temperature_mode") or "ambient"
            temp = temp.lower()
            if "reef" in temp:
                temp = "reefer"
            else:
                temp = "ambient"

            weight_val = norm_row.get("weight_cap_kg") or norm_row.get("capacity_kg") or "3500"
            vol_val = norm_row.get("volume_cap_m3") or norm_row.get("capacity_vol_m3") or "15"
            try:
                capacity_kg = float(weight_val)
            except ValueError:
                capacity_kg = 3500.0

            try:
                capacity_vol_m3 = float(vol_val)
            except ValueError:
                capacity_vol_m3 = 15.0

            fuel_type = norm_row.get("fuel_type") or "diesel"
            km_l_val = norm_row.get("km_per_l") or "6.0"
            quota_val = norm_row.get("weekly_fuel_quota_l") or "500.0"
            try:
                km_per_l = float(km_l_val)
            except ValueError:
                km_per_l = 6.0

            try:
                weekly_fuel_quota_l = float(quota_val)
            except ValueError:
                weekly_fuel_quota_l = 500.0

            depot_raw = norm_row.get("depot") or norm_row.get("depot_name") or "peliyagoda"
            depot_name = "kandy" if "kandy" in depot_raw.lower() else "peliyagoda"

            existing_vehicle = db.query(Vehicle).filter(Vehicle.code == code).first()
            if existing_vehicle:
                existing_vehicle.vehicle_type = v_type
                existing_vehicle.temperature_mode = temp
                existing_vehicle.capacity_kg = capacity_kg
                existing_vehicle.capacity_vol_m3 = capacity_vol_m3
                existing_vehicle.depot_name = depot_name
                existing_vehicle.fuel_type = fuel_type
                existing_vehicle.km_per_l = km_per_l
                existing_vehicle.weekly_fuel_quota_l = weekly_fuel_quota_l
                updated_count += 1
            else:
                new_vehicle = Vehicle(
                    code=code,
                    vehicle_type=v_type,
                    temperature_mode=temp,
                    capacity_kg=capacity_kg,
                    capacity_vol_m3=capacity_vol_m3,
                    depot_name=depot_name,
                    fuel_type=fuel_type,
                    km_per_l=km_per_l,
                    weekly_fuel_quota_l=weekly_fuel_quota_l,
                    status=VehicleStatus.AVAILABLE,
                    trips_today=0,
                    trips_planned=0,
                    weekly_fuel_status="Within quota"
                )
                db.add(new_vehicle)
                imported_count += 1

        except Exception as ex:
            errors.append(f"Row {row_idx}: {str(ex)}")

    db.commit()
    return {
        "success": True,
        "total_rows": imported_count + updated_count,
        "imported": imported_count,
        "updated": updated_count,
        "errors": errors
    }

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
