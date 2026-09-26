from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.shipment import ShipmentStatus


class DispatchTripBase(BaseModel):
    trip_code: str
    vehicle_number: str
    driver_name: str
    origin: str
    destination: str


class DispatchTripCreate(DispatchTripBase):
    departure_time: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None


class DispatchTripRead(DispatchTripBase):
    id: int
    departure_time: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None

    class Config:
        from_attributes = True


class ShipmentBase(BaseModel):
    tracking_number: str
    order_id: int
    dispatch_trip_id: Optional[int] = None
    status: ShipmentStatus = ShipmentStatus.PENDING
    current_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ShipmentCreate(ShipmentBase):
    pass


class ShipmentUpdate(BaseModel):
    status: Optional[ShipmentStatus] = None
    current_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    dispatch_trip_id: Optional[int] = None


class ShipmentRead(ShipmentBase):
    id: int
    last_updated: datetime
    dispatch_trip: Optional[DispatchTripRead] = None

    class Config:
        from_attributes = True
