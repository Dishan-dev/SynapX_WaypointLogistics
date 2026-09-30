import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Boolean, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models import Base


class DeliveryReceipt(Base):
    __tablename__ = "delivery_receipts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False,
        unique=True,       # one receipt per order
        index=True,
    )
    outlet_id: Mapped[str] = mapped_column(String(10), nullable=False)
    units_received: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_received_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    has_issues: Mapped[bool] = mapped_column(Boolean, default=False)
    # short_delivery | damaged | wrong_items | other
    issue_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    issue_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    synced_from_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
