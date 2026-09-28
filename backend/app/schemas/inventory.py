from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class WarehouseBase(BaseModel):
    code: str
    name: str
    location: str
    capacity_sqft: Optional[float] = None


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseRead(WarehouseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class InventoryItemBase(BaseModel):
    sku: str
    name: str
    quantity: int = 0
    unit_price: float = 0.0
    warehouse_id: Optional[int] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemRead(InventoryItemBase):
    id: int
    updated_at: datetime
    warehouse: Optional[WarehouseRead] = None

    model_config = ConfigDict(from_attributes=True)
