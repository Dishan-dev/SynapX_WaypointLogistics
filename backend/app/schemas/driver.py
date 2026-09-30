from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.driver import DriverTripStatus, DeliveryStopStatus, IssueType, IssueStatus, SOSStatus


class ProofOfDeliveryBase(BaseModel):
    recipient_name: str
    signature_data: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class ProofOfDeliveryCreate(ProofOfDeliveryBase):
    pass

class ProofOfDeliveryRead(ProofOfDeliveryBase):
    id: int
    stop_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DeliveryStopBase(BaseModel):
    sequence: int
    address: str
    customer_name: str
    customer_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    status: DeliveryStopStatus = DeliveryStopStatus.PENDING

class DeliveryStopCreate(DeliveryStopBase):
    shipment_id: Optional[int] = None

class DeliveryStopRead(DeliveryStopBase):
    id: int
    driver_trip_id: int
    shipment_id: Optional[int]
    arrived_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    pod: Optional[ProofOfDeliveryRead] = None
    model_config = ConfigDict(from_attributes=True)


class DriverTripBase(BaseModel):
    status: DriverTripStatus = DriverTripStatus.ASSIGNED

class DriverTripCreate(DriverTripBase):
    dispatch_trip_id: int

class DriverTripSummary(DriverTripBase):
    id: int
    driver_id: int
    dispatch_trip_id: int
    assigned_date: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    # Can add fields like stop_count or completed_stops via computed fields if needed
    model_config = ConfigDict(from_attributes=True)

class DriverTripDetail(DriverTripSummary):
    stops: List[DeliveryStopRead] = []


class IssueReportBase(BaseModel):
    issue_type: IssueType
    description: str
    photo_url: Optional[str] = None

class IssueReportCreate(IssueReportBase):
    stop_id: Optional[int] = None

class IssueReportRead(IssueReportBase):
    id: int
    driver_trip_id: int
    stop_id: Optional[int]
    status: IssueStatus
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SOSAlertBase(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    message: Optional[str] = None

class SOSAlertCreate(SOSAlertBase):
    driver_trip_id: Optional[int] = None

class SOSAlertRead(SOSAlertBase):
    id: int
    driver_id: int
    driver_trip_id: Optional[int]
    status: SOSStatus
    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    model_config = ConfigDict(from_attributes=True)


class SyncAction(BaseModel):
    action_id: str  # Unique ID from client to prevent duplicate processing
    action_type: str  # 'arrive', 'outcome', 'pod', 'complete', 'issue'
    stop_id: Optional[int] = None
    trip_id: Optional[int] = None
    payload: dict = {}
    client_timestamp: datetime

class SyncConflict(BaseModel):
    action_id: str
    stop_id: Optional[int]
    reason: str
    server_state: dict

class SyncResult(BaseModel):
    processed_count: int
    conflicts: List[SyncConflict]

