from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.order import OrderStatus


class OrderItemBase(BaseModel):
    sku: str
    item_name: str
    quantity: int
    unit_price: float


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemRead(OrderItemBase):
    id: int
    order_id: int
    quantity_sent: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class OrderBase(BaseModel):
    client_name: str
    destination_address: str
    status: OrderStatus = OrderStatus.DRAFT
    brand: Optional[str] = None
    district: Optional[str] = None
    temperature_zone: str = "Ambient"
    delivery_window: Optional[str] = None
    weight_kg: float = 0.0
    is_priority: bool = False
    is_late: bool = False
    operating_date: Optional[str] = None
    deferral_reason: Optional[str] = None
    allocation_id: Optional[int] = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            if v_upper in OrderStatus.__members__:
                return OrderStatus[v_upper]
        return v


class OrderCreate(OrderBase):
    order_number: str
    total_amount: float = 0.0
    items: List[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    client_name: Optional[str] = None
    destination_address: Optional[str] = None
    status: Optional[OrderStatus] = None
    brand: Optional[str] = None
    district: Optional[str] = None
    temperature_zone: Optional[str] = None
    delivery_window: Optional[str] = None
    weight_kg: Optional[float] = None
    is_priority: Optional[bool] = None
    is_late: Optional[bool] = None
    operating_date: Optional[str] = None
    deferral_reason: Optional[str] = None
    allocation_id: Optional[int] = None


class OrderRead(OrderBase):
    id: int
    order_number: str
    total_amount: float
    items: List[OrderItemRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
