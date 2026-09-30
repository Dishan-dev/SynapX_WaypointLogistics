import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotificationType(str, enum.Enum):
    """docs/store-manager-contract.md §4."""

    ORDER_SUBMITTED = "order_submitted"
    ORDER_CONFIRMED = "order_confirmed"
    DISPATCHER_NOTE = "dispatcher_note"
    SHORTFALL_WARNING = "shortfall_warning"
    DEFERRED = "deferred"
    READY_FOR_DISPATCH = "ready_for_dispatch"
    ETA_UPDATED = "eta_updated"
    DELIVERED = "delivered"
    ISSUE_LOGGED = "issue_logged"
    ORDER_CLOSED = "order_closed"


class NotificationCategory(str, enum.Enum):
    """The Requests / Deliveries / Issues tabs on the Store Manager Notifications screen."""

    REQUEST = "request"
    DELIVERY = "delivery"
    ISSUE = "issue"


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_outlet_is_read", "outlet_id", "is_read"),)

    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    type = Column(Enum(NotificationType), nullable=False)
    category = Column(Enum(NotificationCategory), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order")

    @property
    def order_number(self):
        """Lets the Notifications screen link to the order without a second request."""
        return self.order.order_number if self.order is not None else None
