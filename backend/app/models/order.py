import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class OrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    ALLOCATED = "ALLOCATED"
    DEFERRED = "DEFERRED"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    client_name = Column(String(255), nullable=False)
    destination_address = Column(String(500), nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT, nullable=False)
    total_amount = Column(Float, default=0.0)
    brand = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    temperature_zone = Column(String(50), default="Ambient", nullable=False)
    delivery_window = Column(String(50), nullable=True)
    weight_kg = Column(Float, default=0.0, nullable=False)
    is_priority = Column(Boolean, default=False, nullable=False)
    allocation_id = Column(Integer, ForeignKey("allocations.id"), nullable=True)
    is_late = Column(Boolean, default=False, nullable=False)
    operating_date = Column(String(50), nullable=True)
    deferral_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    shipment = relationship("Shipment", back_populates="order", uselist=False)
    allocation = relationship("Allocation", back_populates="orders")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sku = Column(String(100), nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
