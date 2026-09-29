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

class VehicleCreate(VehicleBase):
    pass

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
