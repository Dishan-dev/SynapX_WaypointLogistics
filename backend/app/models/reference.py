import enum
from sqlalchemy import Boolean, Column, Date, Float, Integer, String, Time, Enum
from app.core.database import Base

# Copied from the loader branch (backend/app/models/reference.py, Sachintha) so the Store Manager
# order rules can use outlets and the operating calendar before loader merges into dev.
# Only the parts Store Manager needs are here. When loader merges, keep the loader's version of this file
# (it also has Dock, DockTablet, etc.). Loader's own Vehicle model is dropped in favour of Thisaru's.


class Depot(str, enum.Enum):
    PELIYAGODA = "peliyagoda"
    KANDY = "kandy"


class Brand(str, enum.Enum):
    FRESH = "fresh"
    STYLE = "style"
    TECH = "tech"


class DockType(str, enum.Enum):
    """How goods come off at the outlet. Affects how the loader arranges the load."""

    REAR_DOCK = "rear_dock"
    STREET = "street"
    MALL_BAY = "mall_bay"


class CalendarDay(Base):
    """One operating day. Seeded from calendar.csv."""

    __tablename__ = "calendar_days"

    date = Column(Date, primary_key=True, index=True)
    is_operating = Column(Boolean, default=True, nullable=False)
    festival_ramp = Column(Float, default=1.0, nullable=False)
    monsoon = Column(Boolean, default=False, nullable=False)
    holiday_name = Column(String(100), nullable=True)


class Outlet(Base):
    """A store the run delivers to. Seeded from outlets.csv.

    van_only outlets cannot be served by a truck - the queue shows this as a chip.
    """

    __tablename__ = "outlets"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    brand = Column(Enum(Brand), nullable=False)
    district = Column(String(100), nullable=False)
    dock_type = Column(Enum(DockType), nullable=False)
    van_only = Column(Boolean, default=False, nullable=False)
    window_start = Column(Time, nullable=True)
    window_end = Column(Time, nullable=True)
    depot = Column(Enum(Depot), default=Depot.PELIYAGODA, nullable=False)
