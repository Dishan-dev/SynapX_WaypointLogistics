import enum
from datetime import datetime, timezone
from sqlalchemy import String, Float, ForeignKey, DateTime, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class VehicleStatus(str, enum.Enum):
    AVAILABLE = "available"
    ALLOCATED = "allocated"
    LOADING = "loading"
    UNAVAILABLE = "unavailable"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False) # e.g. VEH014
    vehicle_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. Reefer 6T
    capacity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    capacity_vol_m3: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[VehicleStatus] = mapped_column(Enum(VehicleStatus), default=VehicleStatus.AVAILABLE, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    driver = relationship("DriverProfile", back_populates="vehicle", uselist=False)
    allocations = relationship("Allocation", back_populates="vehicle")


class DriverProfile(Base):
    """Extended profile for users with DRIVER role."""
    __tablename__ = "driver_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    license_type: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    assigned_vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="driver_profile")
    vehicle = relationship("Vehicle", back_populates="driver")
    allocations = relationship("Allocation", back_populates="driver")
