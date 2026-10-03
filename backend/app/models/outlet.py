from datetime import datetime, time, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Outlet(Base):
    __tablename__ = "outlets"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    district: Mapped[str | None] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    delivery_restrictions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    contacts: Mapped[list["OutletContact"]] = relationship(back_populates="outlet", cascade="all, delete-orphan", order_by="OutletContact.id")
    receiving_windows: Mapped[list["OutletReceivingWindow"]] = relationship(back_populates="outlet", cascade="all, delete-orphan", order_by="OutletReceivingWindow.id")


class OutletContact(Base):
    __tablename__ = "outlet_contacts"
    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    outlet: Mapped[Outlet] = relationship(back_populates="contacts")


class OutletReceivingWindow(Base):
    __tablename__ = "outlet_receiving_windows"
    __table_args__ = (UniqueConstraint("outlet_id", "weekday", "opens_at", "closes_at", name="uq_outlet_window"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # Monday=0, Sunday=6
    opens_at: Mapped[time] = mapped_column(Time, nullable=False)
    closes_at: Mapped[time] = mapped_column(Time, nullable=False)
    outlet: Mapped[Outlet] = relationship(back_populates="receiving_windows")
