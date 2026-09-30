from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api import deps
from app.models.order import OrderStatus
from app.models.reference import Depot
from app.schemas.store_order import GoodsRequestCreate, OrderDeferral, OrderStatusUpdate, StoreOrderRead
from app.services.order_service import order_service

# Store Manager order routes (docs/store-manager-contract.md §5). Registered before the generic /orders
# router so /orders/store isn't read as /orders/{order_id}. Auth comes with Keycloak; outlet_id is passed
# explicitly until then.
router = APIRouter()


@router.post("/store", response_model=List[StoreOrderRead], status_code=status.HTTP_201_CREATED)
def place_goods_request(
    request: GoodsRequestCreate,
    db: Session = Depends(deps.get_db),
    now: datetime = Depends(deps.get_now),
):
    """Place a goods request. Returns one order per temperature zone (chilled and ambient ship separately)."""
    return order_service.place_order(db, request, now)


@router.get("/store", response_model=List[StoreOrderRead])
def list_store_orders(
    outlet_id: int,
    status_filter: Optional[List[OrderStatus]] = Query(default=None, alias="status"),
    priority: Optional[bool] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = Query(default=None, max_length=100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(deps.get_db),
):
    """Goods Requests list (Figma 02). Repeat ?status= for several statuses; dates filter on submission."""
    return order_service.get_orders(db, outlet_id, status_filter, priority, date_from, date_to, search, skip, limit)


@router.get("/by-date", response_model=List[StoreOrderRead])
def orders_for_loading(day: date = Query(alias="date"), depot: Depot = Depot.PELIYAGODA, db: Session = Depends(deps.get_db)):
    """Contract for the loader: active orders for one delivery date at one depot."""
    return order_service.get_orders_by_date(db, day, depot)


@router.get("/store/{order_number}", response_model=StoreOrderRead)
def get_store_order(order_number: str, db: Session = Depends(deps.get_db)):
    """Request Details (Figma 04), looked up by order number, e.g. ORD0000001."""
    return order_service.get_order_by_number(db, order_number)


@router.post("/{order_id}/cancel", response_model=StoreOrderRead)
def cancel_store_order(order_id: int, db: Session = Depends(deps.get_db), now: datetime = Depends(deps.get_now)):
    """Cancel before the 4 PM cutoff on the day before delivery."""
    return order_service.cancel_order(db, order_id, now)


@router.patch("/{order_id}/status", response_model=StoreOrderRead)
def update_order_status(order_id: int, update: OrderStatusUpdate, db: Session = Depends(deps.get_db)):
    """Contract for Loader / Driver / Dispatcher flows. Rejects illegal moves with 409."""
    return order_service.update_order_status(db, order_id, update.status)


@router.post("/{order_id}/defer", response_model=StoreOrderRead)
def defer_order(order_id: int, deferral: OrderDeferral, db: Session = Depends(deps.get_db)):
    """Dispatcher defers an order and the store is notified with the reason."""
    return order_service.defer_order(db, order_id, deferral.reason, deferral.new_delivery_date)
