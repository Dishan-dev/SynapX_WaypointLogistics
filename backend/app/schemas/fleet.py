from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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
    fuel_type: str = "diesel"
    km_per_l: float = 6.0
    weekly_fuel_quota_l: float = 500.0
    assigned_driver_id: Optional[int] = None

class VehicleCreate(VehicleBase):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    code: str = Field(min_length=1, max_length=20)
    vehicle_type: str = Field(min_length=1, max_length=50)
    capacity_kg: float = Field(gt=0, allow_inf_nan=False)
    capacity_vol_m3: float = Field(default=0, ge=0, allow_inf_nan=False)
    temperature_mode: str = Field(default="ambient", min_length=1, max_length=50)
    depot_name: str = Field(default="Central Depot", min_length=1, max_length=100)
    weekly_fuel_status: str = Field(default="Not recorded", min_length=1, max_length=50)
    maintenance_state: Optional[str] = Field(default=None, max_length=100)
    trips_today: int = Field(default=0, ge=0)
    trips_planned: int = Field(default=0, ge=0)
    assigned_driver_id: Optional[int] = Field(default=None)

    @field_validator("status")
    @classmethod
    def manual_status(cls, value):
        if value not in (VehicleStatus.AVAILABLE, VehicleStatus.UNAVAILABLE):
            raise ValueError("Allocation and loading statuses are managed by their workflows")
        return value


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
    fuel_type: Optional[str] = None
    km_per_l: Optional[float] = None
    weekly_fuel_quota_l: Optional[float] = None
    assigned_driver_id: Optional[int] = None

class VehicleResponse(VehicleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    assigned_driver_name: Optional[str] = None
    assigned_driver_phone: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class VehicleDriverAssignRequest(BaseModel):
    driver_user_id: Optional[int] = None

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
