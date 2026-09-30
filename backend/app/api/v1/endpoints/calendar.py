from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.schemas.store_order import OperatingDaysRead
from app.services.calendar_service import calendar_service

router = APIRouter()


@router.get("/operating-days", response_model=OperatingDaysRead)
def operating_days(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(deps.get_db),
    now: datetime = Depends(deps.get_now),
):
    """Delivery dates for the New Goods Request date picker (Figma 03c). Defaults to the next 60 days."""
    start = date_from or now.date()
    end = date_to or start + timedelta(days=60)
    if end < start or (end - start).days > 366:
        raise HTTPException(status_code=400, detail="Choose a range of up to one year, with date_to after date_from.")
    return {
        "operating_days": calendar_service.operating_days(db, start, end),
        "earliest_default": calendar_service.earliest_delivery_date(db, now, False),
        "earliest_high_priority": calendar_service.earliest_delivery_date(db, now, True),
    }
