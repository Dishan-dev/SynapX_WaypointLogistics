import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.reference import Brand, TemperatureClass


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    client_name = Column(String(255), nullable=False)
    destination_address = Column(String(500), nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT, nullable=False)
    total_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # --- Loader module fields -------------------------------------------------
    # Added for the loader's stop-sequence checklist. All nullable and additive:
    # existing rows and existing callers are unaffected.
    #
    # These are order-level facts, not loader-only ones - the dispatcher needs
    # temperature_class to keep chilled orders on reefers, and weight/volume to
    # allocate against vehicle limits. Coordinated with the dispatcher and driver
    # teams before merge, per docs/loader/GITHUB_WORKFLOW.md.
    #
    # Deliberately order-level aggregates rather than per-OrderItem columns: the
    # loader screens only ever show a whole-order figure ("44 units - 650 kg -
    # 3.2 m3"), never a line-item breakdown, so OrderItem needs no change.
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=True)
    brand = Column(Enum(Brand), nullable=True)
    temperature_class = Column(Enum(TemperatureClass), nullable=True)
    units = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    volume_m3 = Column(Float, nullable=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    shipment = relationship("Shipment", back_populates="order", uselist=False)
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
