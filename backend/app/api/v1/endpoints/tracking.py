from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.models.shipment import Shipment
from app.schemas.shipment import ShipmentCreate, ShipmentRead, ShipmentUpdate
from app.services.tracking_service import tracking_service

router = APIRouter()


@router.get("/", response_model=List[ShipmentRead])
def list_shipments(skip: int = 0, limit: int = 50, db: Session = Depends(deps.get_db)):
    return db.query(Shipment).offset(skip).limit(limit).all()


@router.post("/", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
def create_shipment(shipment_in: ShipmentCreate, db: Session = Depends(deps.get_db)):
    existing = db.query(Shipment).filter(Shipment.tracking_number == shipment_in.tracking_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tracking number already exists")
    shipment = Shipment(**shipment_in.model_dump())
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.get("/{tracking_number}", response_model=ShipmentRead)
def track_shipment(tracking_number: str, db: Session = Depends(deps.get_db)):
    shipment = db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment


@router.patch("/{tracking_number}", response_model=ShipmentRead)
def update_shipment_status(
    tracking_number: str,
    update_in: ShipmentUpdate,
    db: Session = Depends(deps.get_db)
):
    try:
        return tracking_service.update_location(
            db=db,
            tracking_number=tracking_number,
            location=update_in.current_location,
            status=update_in.status,
            lat=update_in.latitude,
            lng=update_in.longitude,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
