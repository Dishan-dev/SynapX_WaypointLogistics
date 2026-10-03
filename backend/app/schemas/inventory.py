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
    chain: Optional[str] = None
    unit_weight_kg: float = 0.0
    unit_volume_m3: float = 0.0
    temp_requirement: str = "Ambient"
    depot_name: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemRead(InventoryItemBase):
    id: int
    updated_at: datetime
    warehouse: Optional[WarehouseRead] = None

    model_config = ConfigDict(from_attributes=True)


class ChainStockSummary(BaseModel):
    chain: str
    total_skus: int
    total_quantity: int
    total_weight_kg: float
    total_volume_m3: float
    low_stock_count: int
    last_updated: Optional[datetime] = None

