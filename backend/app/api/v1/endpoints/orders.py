from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate
from app.services.order_service import order_service

router = APIRouter()


@router.get("/", response_model=List[OrderRead])
def list_orders(skip: int = 0, limit: int = 50, db: Session = Depends(deps.get_db)):
    return db.query(Order).offset(skip).limit(limit).all()


@router.post("/", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(order_in: OrderCreate, db: Session = Depends(deps.get_db)):
    existing = db.query(Order).filter(Order.order_number == order_in.order_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Order number already exists")
    return order_service.create_order(db=db, order_in=order_in)


@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(deps.get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}", response_model=OrderRead)
def update_order(order_id: int, order_in: OrderUpdate, db: Session = Depends(deps.get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    update_data = order_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(order, field, val)
    db.commit()
    db.refresh(order)
    return order
