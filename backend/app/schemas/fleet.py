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

    @field_validator("status")
    @classmethod
    def manual_status(cls, value):
        if value not in (VehicleStatus.AVAILABLE, VehicleStatus.UNAVAILABLE):
            raise ValueError("Allocation and loading statuses are managed by their workflows")
        return value


class VehicleUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    expected_updated_at: datetime
    code: Optional[str] = Field(default=None, min_length=1, max_length=20)
    vehicle_type: Optional[str] = Field(default=None, min_length=1, max_length=50)
    capacity_kg: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False)
    capacity_vol_m3: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    temperature_mode: Optional[str] = Field(default=None, min_length=1, max_length=50)
    depot_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    weekly_fuel_status: Optional[str] = Field(default=None, min_length=1, max_length=50)
    maintenance_state: Optional[str] = Field(default=None, max_length=100)
    status: Optional[VehicleStatus] = None

    @model_validator(mode="after")
    def valid_patch(self):
        fields = self.model_fields_set - {"expected_updated_at"}
        if not fields:
            raise ValueError("Provide at least one field to update")
        if any(getattr(self, name) is None for name in fields - {"maintenance_state"}):
            raise ValueError("Only maintenance_state may be cleared")
        if "status" in fields and self.status not in (VehicleStatus.AVAILABLE, VehicleStatus.UNAVAILABLE):
            raise ValueError("Allocation and loading statuses are managed by their workflows")
        return self

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
