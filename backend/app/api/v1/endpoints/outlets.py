from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from app.api.deps import get_db, require_dispatcher_or_admin
from app.models.outlet import Outlet, OutletContact, OutletReceivingWindow
from app.models.user import User
from app.schemas.outlet import OutletCreate, OutletRead, OutletUpdate
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api import deps
from app.schemas.outlet_settings import OutletSettingsRead, OutletSettingsUpdate
from app.services.outlet_service import outlet_service

router = APIRouter()


def detail_query(db: Session):
    return db.query(Outlet).options(selectinload(Outlet.contacts), selectinload(Outlet.receiving_windows))


@router.get("/", response_model=list[OutletRead])
def list_outlets(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100), db: Session = Depends(get_db)):
    return detail_query(db).order_by(Outlet.id).offset(skip).limit(limit).all()


@router.get("/{outlet_id}", response_model=OutletRead)
def get_outlet(outlet_id: int, db: Session = Depends(get_db)):
    outlet = detail_query(db).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return outlet


def set_children(outlet: Outlet, data):
    outlet.contacts = [OutletContact(**contact.model_dump()) for contact in data.contacts]
    outlet.receiving_windows = [OutletReceivingWindow(**window.model_dump()) for window in data.receiving_windows]


@router.post("/", response_model=OutletRead, status_code=status.HTTP_201_CREATED)
def create_outlet(data: OutletCreate, db: Session = Depends(get_db), _: User = Depends(require_dispatcher_or_admin)):
    outlet = Outlet(**data.model_dump(exclude={"contacts", "receiving_windows"}))
    set_children(outlet, data)
    db.add(outlet)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Outlet code or receiving window already exists")
    return get_outlet(outlet.id, db)


@router.put("/{outlet_id}", response_model=OutletRead)
def update_outlet(outlet_id: int, data: OutletUpdate, db: Session = Depends(get_db), _: User = Depends(require_dispatcher_or_admin)):
    outlet = detail_query(db).filter(Outlet.id == outlet_id).with_for_update().first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    def utc_naive(value):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
    if utc_naive(outlet.updated_at) != utc_naive(data.expected_updated_at):
        raise HTTPException(status_code=409, detail="Outlet changed since you opened it. Refresh and try again.")
    for key, value in data.model_dump(exclude={"contacts", "receiving_windows", "expected_updated_at"}).items():
        setattr(outlet, key, value)
    # Child-only edits must advance the parent version used for conflict detection.
    outlet.updated_at = datetime.now(timezone.utc)
    # Full replacement is deliberate: the submitted contact and window lists are authoritative.
    outlet.contacts.clear()
    outlet.receiving_windows.clear()
    db.flush()
    set_children(outlet, data)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Outlet code or receiving window already exists")
    return get_outlet(outlet.id, db)
@router.get("/{outlet_id}/settings", response_model=OutletSettingsRead)
def get_outlet_settings(
    outlet_id: str,
    db: Session = Depends(deps.get_db),
):
    """Retrieve outlet profile, delivery & unloading parameters, and access preferences."""
    return outlet_service.get_settings(db, outlet_id)


@router.patch("/{outlet_id}/settings", response_model=OutletSettingsRead)
def update_outlet_settings(
    outlet_id: str,
    update_data: OutletSettingsUpdate,
    db: Session = Depends(deps.get_db),
):
    """Update editable outlet contacts and notification/access preferences."""
    return outlet_service.update_settings(db, outlet_id, update_data)


@router.post("/{outlet_id}/settings/reset", response_model=OutletSettingsRead)
def reset_outlet_settings(
    outlet_id: str,
    db: Session = Depends(deps.get_db),
):
    """Reset editable outlet settings to default verified values."""
    return outlet_service.reset_settings(db, outlet_id)
