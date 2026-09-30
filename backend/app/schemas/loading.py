import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class LoadingTaskSummary(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    vehicle_id: str
    outlet_id: str
    outlet_name: str
    brand: str
    district: str
    temp_requirement: str
    order_units: int
    order_weight_kg: float
    order_volume_m3: float
    is_high_priority: bool
    status: str
    loaded_units: Optional[int] = None
    seq_in_route: int

    model_config = ConfigDict(from_attributes=True)


class StartLoadingRequest(BaseModel):
    loader_id: uuid.UUID


class UpdateItemRequest(BaseModel):
    loaded_units: int


class ShortfallRequest(BaseModel):
    shortfall_notes: str
    loaded_units: int


class LoadingTaskResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    vehicle_id: str
    status: str
    loaded_units: Optional[int] = None
    shortfall_notes: Optional[str] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
