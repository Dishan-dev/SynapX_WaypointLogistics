from sqlalchemy.orm import Session
from app.models.inventory import InventoryItem
from app.schemas.inventory import InventoryItemCreate


class InventoryService:
    @staticmethod
    def adjust_stock(db: Session, sku: str, delta: int) -> InventoryItem:
        item = db.query(InventoryItem).filter(InventoryItem.sku == sku).first()
        if not item:
            raise ValueError(f"Inventory item with SKU '{sku}' not found.")
        if item.quantity + delta < 0:
            raise ValueError(f"Insufficient stock for SKU '{sku}'. Available: {item.quantity}, Requested adjustment: {delta}")
        item.quantity += delta
        db.commit()
        db.refresh(item)
        return item


inventory_service = InventoryService()
