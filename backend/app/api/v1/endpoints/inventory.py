from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.models.inventory import InventoryItem, Warehouse
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemRead,
    WarehouseCreate,
    WarehouseRead,
)

router = APIRouter()


@router.get("/warehouses", response_model=List[WarehouseRead])
def list_warehouses(skip: int = 0, limit: int = 50, db: Session = Depends(deps.get_db)):
    return db.query(Warehouse).offset(skip).limit(limit).all()


@router.post("/warehouses", response_model=WarehouseRead, status_code=status.HTTP_201_CREATED)
def create_warehouse(warehouse_in: WarehouseCreate, db: Session = Depends(deps.get_db)):
    warehouse = Warehouse(**warehouse_in.model_dump())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return warehouse


@router.get("/items", response_model=List[InventoryItemRead])
def list_items(skip: int = 0, limit: int = 100, db: Session = Depends(deps.get_db)):
    return db.query(InventoryItem).offset(skip).limit(limit).all()


@router.post("/items", response_model=InventoryItemRead, status_code=status.HTTP_201_CREATED)
def create_item(item_in: InventoryItemCreate, db: Session = Depends(deps.get_db)):
    existing = db.query(InventoryItem).filter(InventoryItem.sku == item_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="Item SKU already exists")
    item = InventoryItem(**item_in.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
