from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class OutletSettings(Base):
    """Preferences, contact overrides, and delivery details for an outlet."""

    __tablename__ = "outlet_settings"

    id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), unique=True, nullable=False, index=True)
    store_manager = Column(String(255), default="Sarah Jenkins · MGR-88", nullable=False)
    contact_phone = Column(String(50), default="+94 11 234 5678", nullable=False)
    emergency_contact = Column(String(255), default="Kamal S. (Backroom Lead) · ext 8802", nullable=False)
    parking = Column(String(100), default="No restrictions", nullable=False)
    driver_check_in_call = Column(Boolean, default=True, nullable=False)
    share_dock_gate_code = Column(Boolean, default=True, nullable=False)
    email_alerts_issues = Column(Boolean, default=True, nullable=False)
    sms_alerts_priority = Column(Boolean, default=False, nullable=False)
    last_synced_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    outlet = relationship("Outlet")
