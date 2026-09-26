from typing import Optional
from sqlalchemy.orm import Session
from app.models.shipment import Shipment, ShipmentStatus
from app.schemas.shipment import ShipmentUpdate


class TrackingService:
    @staticmethod
    def update_location(
        db: Session,
        tracking_number: str,
        location: str,
        status: Optional[ShipmentStatus] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
    ) -> Shipment:
        shipment = db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first()
        if not shipment:
            raise ValueError(f"Shipment with tracking number '{tracking_number}' not found.")
        
        shipment.current_location = location
        if status:
            shipment.status = status
        if lat is not None:
            shipment.latitude = lat
        if lng is not None:
            shipment.longitude = lng
        
        db.commit()
        db.refresh(shipment)
        return shipment


tracking_service = TrackingService()
