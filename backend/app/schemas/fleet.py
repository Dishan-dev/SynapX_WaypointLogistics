from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from app.models.fleet import VehicleStatus
from app.schemas.auth import UserRead

class VehicleBase(BaseModel):
    code: str
    vehicle_type: str
    capacity_kg: float
    capacity_vol_m3: float = 0.0
    status: VehicleStatus = VehicleStatus.AVAILABLE
    temperature_mode: str = "Ambient"
    depot_name: str = "Central Depot"
    weekly_fuel_status: str = "Within quota"
    trips_today: int = 0
    trips_planned: int = 0
    maintenance_state: Optional[str] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    code: Optional[str] = None
    vehicle_type: Optional[str] = None
    capacity_kg: Optional[float] = None
    capacity_vol_m3: Optional[float] = None
    status: Optional[VehicleStatus] = None
    temperature_mode: Optional[str] = None
    depot_name: Optional[str] = None
    weekly_fuel_status: Optional[str] = None
    trips_today: Optional[int] = None
    trips_planned: Optional[int] = None
    maintenance_state: Optional[str] = None

class VehicleResponse(VehicleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DriverProfileBase(BaseModel):
    license_type: str
    phone: str
    assigned_vehicle_id: Optional[int] = None

class DriverProfileCreate(DriverProfileBase):
    user_id: int

class DriverProfileResponse(DriverProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    # The actual user profile from the relationship
    user: Optional["UserRead"] = None

    model_config = ConfigDict(from_attributes=True)
