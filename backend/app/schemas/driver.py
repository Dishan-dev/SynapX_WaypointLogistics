from typing import List, Optional, Annotated
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, PlainSerializer
from app.models.driver import DriverTripStatus, DeliveryStopStatus, IssueType, IssueStatus, SOSStatus

# Columns are stored as naive UTC (no DB timezone column, to avoid a migration
# on the shared Neon DB). Stamp UTC back on before serializing so clients don't
# misread the naive value as local time.
def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

UTCDateTime = Annotated[datetime, PlainSerializer(_as_utc, return_type=datetime)]


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
    created_at: UTCDateTime
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
    arrived_at: Optional[UTCDateTime]
    completed_at: Optional[UTCDateTime]
    created_at: UTCDateTime
    pod: Optional[ProofOfDeliveryRead] = None
    model_config = ConfigDict(from_attributes=True)


class StopOrderItem(BaseModel):
    sku: str
    item_name: str
    quantity: int


class StopOrderInfo(BaseModel):
    order_number: str
    brand: Optional[str] = None
    temperature_zone: Optional[str] = None
    delivery_window: Optional[str] = None
    units: Optional[int] = None
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    notes: Optional[str] = None
    on_truck: bool = True  # False: on the plan but the loader didn't load it
    items: List[StopOrderItem] = []


class DeliveryStopDetail(DeliveryStopRead):
    """A stop plus the orders being delivered there (for the at-stop screens)."""
    total_stops: int
    trip_status: DriverTripStatus
    order: Optional[StopOrderInfo] = None  # the first of `orders`
    orders: List[StopOrderInfo] = []


class DriverTripBase(BaseModel):
    status: DriverTripStatus = DriverTripStatus.ASSIGNED

class DriverTripCreate(DriverTripBase):
    dispatch_trip_id: int

class DriverTripSummary(DriverTripBase):
    id: int
    driver_id: int
    dispatch_trip_id: int
    assigned_date: UTCDateTime
    started_at: Optional[UTCDateTime]
    completed_at: Optional[UTCDateTime]
    created_at: UTCDateTime
    planned_departure: Optional[UTCDateTime] = None  # the dispatcher's departure time

    # Can add fields like stop_count or completed_stops via computed fields if needed
    model_config = ConfigDict(from_attributes=True)

class DriverTripDetail(DriverTripSummary):
    stops: List[DeliveryStopRead] = []
    last_window_closes: Optional[str] = None  # "HH:MM", latest outlet window end on the run


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
    created_at: UTCDateTime
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
    triggered_at: UTCDateTime
    acknowledged_at: Optional[UTCDateTime]
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

