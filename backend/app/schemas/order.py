from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)


class OrderBase(BaseModel):
    client_name: str
    destination_address: str
    status: OrderStatus = OrderStatus.DRAFT


class OrderCreate(OrderBase):
    order_number: str
    items: List[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    client_name: Optional[str] = None
    destination_address: Optional[str] = None
    status: Optional[OrderStatus] = None


class OrderRead(OrderBase):
    id: int
    order_number: str
    total_amount: float
    items: List[OrderItemRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
