import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class OrderStatus(str, enum.Enum):
    """Order lifecycle (docs/store-manager-contract.md §1).

    The database stores the member *names* (e.g. READY_FOR_DISPATCH), so ALLOCATED and DEFERRED
    match the labels Nisith's migration 0a80c3e0353c added. SUBMITTED, READY_FOR_DISPATCH and
    COMPLETED still need adding to the Postgres enum by the Store Manager migration.
    """

    DRAFT = "draft"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    ALLOCATED = "allocated"
    PROCESSING = "processing"
    READY_FOR_DISPATCH = "ready_for_dispatch"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    DEFERRED = "deferred"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    client_name = Column(String(255), nullable=False)
    destination_address = Column(String(500), nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT, nullable=False)
    total_amount = Column(Float, default=0.0)
    allocation_id = Column(Integer, ForeignKey("allocations.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Dispatcher order-management fields (Nisith, migration 0a80c3e0353c — already in Neon).
    brand = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    temperature_zone = Column(String(50), default="Ambient", nullable=False)
    delivery_window = Column(String(50), nullable=True)
    weight_kg = Column(Float, default=0.0, nullable=False)
    is_priority = Column(Boolean, default=False, nullable=False)
    is_late = Column(Boolean, default=False, nullable=False)
    # Requested delivery date as YYYY-MM-DD.
    operating_date = Column(String(50), nullable=True)
    deferral_reason = Column(String(255), nullable=True)

    # Loader order fields (Sachintha, migration 0003_order_loader_fields).
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=True)
    units = Column(Integer, nullable=True)
    volume_m3 = Column(Float, nullable=True)

    # Store Manager fields (Dev A migration, not yet written).
    submitted_at = Column(DateTime, nullable=True)
    cutoff_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    placed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deferral_count = Column(Integer, default=0, nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    shipment = relationship("Shipment", back_populates="order", uselist=False)
    allocation = relationship("Allocation", back_populates="orders")
    outlet = relationship("Outlet")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sku = Column(String(100), nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
