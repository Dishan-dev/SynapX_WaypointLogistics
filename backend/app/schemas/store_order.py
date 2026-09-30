from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.order import OrderStatus
from app.schemas.order import OrderItemRead

TemperatureZone = Literal["Chilled", "Ambient"]


class GoodsRequestItem(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    item_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(gt=0, le=999)
    temperature_zone: TemperatureZone
    unit_price: float = Field(default=0.0, ge=0)


class GoodsRequestCreate(BaseModel):
    """A Store Manager goods request. Mixed chilled/ambient requests become one order per zone (Q1)."""

    outlet_id: int
    delivery_date: date
    is_priority: bool = False
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[GoodsRequestItem] = Field(min_length=1)


class StoreOrderRead(BaseModel):
    id: int
    order_number: str
    status: OrderStatus
    outlet_id: Optional[int] = None
    brand: Optional[str] = None
    temperature_zone: str
    operating_date: Optional[str] = None
    delivery_window: Optional[str] = None
    is_priority: bool
    units: Optional[int] = None
    weight_kg: float
    total_amount: float
    notes: Optional[str] = None
    submitted_at: Optional[datetime] = None
    cutoff_at: Optional[datetime] = None
    deferral_reason: Optional[str] = None
    deferral_count: int
    items: List[OrderItemRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    """Contract: order_service.update_order_status — called by the Loader/Driver/Dispatcher flows."""

    status: OrderStatus

    @field_validator("status", mode="before")
    @classmethod
    def accept_lowercase(cls, value):
        return value.upper() if isinstance(value, str) else value


class OrderDeferral(BaseModel):
    """Dispatcher defers an order to a later operating day and says why."""

    reason: str = Field(min_length=1, max_length=255)
    new_delivery_date: Optional[date] = None


class OperatingDaysRead(BaseModel):
    """Delivery dates the Store Manager can pick (Figma 03c date picker)."""

    operating_days: List[date]
    earliest_default: date
    earliest_high_priority: date
