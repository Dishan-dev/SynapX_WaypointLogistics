import csv
import io
from typing import Any
from datetime import datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, selectinload
from app.api.deps import get_db, require_dispatcher_or_admin
from app.models.outlet import Outlet, OutletContact, OutletReceivingWindow
from app.models.user import User
from app.models.reference import Brand, Depot, DockType
from app.schemas.outlet import OutletCreate, OutletRead, OutletUpdate
from fastapi.responses import Response
from pydantic import BaseModel
from app.api import deps
from app.schemas.outlet_settings import OutletSettingsRead, OutletSettingsUpdate
from app.services.outlet_service import outlet_service

router = APIRouter()

class OutletCSVImportRequest(BaseModel):
    csv_content: str

@router.get("/export-csv")
def export_outlets_csv(
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Export all outlets as CSV matching standard fleet/operations format:
    outlet_id,brand,district,depot,dock_type,parking_constraint,mall_window,window_open_time,window_close_time
    """
    outlets = db.query(Outlet).order_by(Outlet.code.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "outlet_id",
        "brand",
        "district",
        "depot",
        "dock_type",
        "parking_constraint",
        "mall_window",
        "window_open_time",
        "window_close_time"
    ])
    for o in outlets:
        brand_str = o.brand.value.title() if hasattr(o.brand, "value") else str(o.brand).title()
        depot_str = o.depot.value.title() if hasattr(o.depot, "value") else str(o.depot).title()
        dock_str = o.dock_type.value if hasattr(o.dock_type, "value") else str(o.dock_type)
        parking_str = getattr(o, "parking_constraint", None) or ("van_only" if o.van_only else "normal")
        mall_str = getattr(o, "mall_window", None) or ""
        open_time = o.window_start.strftime("%H:%M") if o.window_start else "06:00"
        close_time = o.window_end.strftime("%H:%M") if o.window_end else "18:00"

        writer.writerow([
            o.code,
            brand_str,
            o.district,
            depot_str,
            dock_str,
            parking_str,
            mall_str,
            open_time,
            close_time
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=waypoint_outlets.csv"}
    )

@router.post("/import-csv")
def import_outlets_csv(
    payload: OutletCSVImportRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Import or bulk update outlets via CSV string.
    Supported headers:
    outlet_id, brand, district, depot, dock_type, parking_constraint, mall_window, window_open_time, window_close_time
    """
    raw_content = payload.csv_content.strip()
    if not raw_content:
        raise HTTPException(status_code=400, detail="CSV content is empty")

    stream = io.StringIO(raw_content)
    reader = csv.DictReader(stream)

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Invalid CSV format: no headers found")

    imported_count = 0
    updated_count = 0
    errors = []

    for row_idx, row in enumerate(reader, start=2):
        try:
            norm_row = {str(k).strip().lower(): (str(v).strip() if v else "") for k, v in row.items() if k}

            code = norm_row.get("outlet_id") or norm_row.get("code") or norm_row.get("id")
            if not code:
                errors.append(f"Row {row_idx}: Missing outlet_id/code")
                continue
            code = code.upper()

            brand_raw = norm_row.get("brand", "").lower()
            if "style" in brand_raw:
                brand_enum = Brand.STYLE
            elif "tech" in brand_raw:
                brand_enum = Brand.TECH
            else:
                brand_enum = Brand.FRESH

            district = norm_row.get("district") or "Colombo"

            depot_raw = norm_row.get("depot", "").lower()
            depot_enum = Depot.KANDY if "kandy" in depot_raw else Depot.PELIYAGODA

            dock_raw = norm_row.get("dock_type", "").lower()
            if "mall" in dock_raw or "bay" in dock_raw:
                dock_enum = DockType.MALL_BAY
            elif "street" in dock_raw:
                dock_enum = DockType.STREET
            else:
                dock_enum = DockType.REAR_DOCK

            parking_constraint = norm_row.get("parking_constraint", "").lower()
            if not parking_constraint:
                parking_constraint = "normal"
            van_only = (parking_constraint == "van_only")

            w_start = None
            open_str = norm_row.get("window_open_time") or norm_row.get("window_start")
            if open_str:
                parts = open_str.split(":")
                w_start = time(hour=int(parts[0]), minute=int(parts[1]))
            else:
                w_start = time(6, 0)

            w_end = None
            close_str = norm_row.get("window_close_time") or norm_row.get("window_end")
            if close_str:
                parts = close_str.split(":")
                w_end = time(hour=int(parts[0]), minute=int(parts[1]))
            else:
                w_end = time(18, 0)

            brand_disp = brand_enum.value.title()
            outlet_name = f"{brand_disp} {district}"

            existing_outlet = db.query(Outlet).filter(Outlet.code == code).first()
            if existing_outlet:
                existing_outlet.brand = brand_enum
                existing_outlet.district = district
                existing_outlet.depot = depot_enum
                existing_outlet.dock_type = dock_enum
                existing_outlet.van_only = van_only
                existing_outlet.window_start = w_start
                existing_outlet.window_end = w_end
                if not existing_outlet.name:
                    existing_outlet.name = outlet_name
                updated_count += 1
            else:
                new_outlet = Outlet(
                    code=code,
                    name=outlet_name,
                    brand=brand_enum,
                    district=district,
                    depot=depot_enum,
                    dock_type=dock_enum,
                    van_only=van_only,
                    window_start=w_start,
                    window_end=w_end,
                )
                db.add(new_outlet)
                imported_count += 1

        except Exception as ex:
            errors.append(f"Row {row_idx}: {str(ex)}")

    db.commit()
    return {
        "success": True,
        "total_rows": imported_count + updated_count,
        "imported": imported_count,
        "updated": updated_count,
        "errors": errors
    }

def profile_ready(db: Session) -> bool:
    columns = {column["name"] for column in inspect(db.get_bind()).get_columns("outlets")}
    return {"address", "active", "delivery_restrictions", "created_at", "updated_at"}.issubset(columns) and inspect(db.get_bind()).has_table("outlet_contacts") and inspect(db.get_bind()).has_table("outlet_receiving_windows")


def legacy_outlets(db: Session, skip: int, limit: int, outlet_id: int | None = None):
    """Read loader-owned outlets without touching profile columns awaiting migration."""
    columns = {column["name"] for column in inspect(db.get_bind()).get_columns("outlets")}
    extras = [name for name in ("parking_constraint", "mall_window") if name in columns]
    names = ["id", "code", "name", "brand", "district", "dock_type", "van_only", "window_start", "window_end", "depot", *extras]
    condition = "WHERE id = :outlet_id" if outlet_id is not None else ""
    rows = db.execute(text(f"SELECT {', '.join(names)} FROM outlets {condition} ORDER BY id LIMIT :limit OFFSET :skip"), {"skip": skip, "limit": limit, "outlet_id": outlet_id}).mappings().all()
    return [{**dict(row), "brand": Brand[row["brand"]], "depot": Depot[row["depot"]], "dock_type": DockType[row["dock_type"]], "mall_window": str(row["mall_window"]) if row.get("mall_window") is not None else None, "address": None, "active": None, "delivery_restrictions": None, "contacts": [], "receiving_windows": [], "created_at": None, "updated_at": None} for row in rows]


def detail_query(db: Session):
    return db.query(Outlet).options(selectinload(Outlet.contacts), selectinload(Outlet.receiving_windows))


@router.get("/", response_model=list[OutletRead])
def list_outlets(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100), db: Session = Depends(get_db)):
    if not profile_ready(db):
        return legacy_outlets(db, skip, limit)
    return detail_query(db).order_by(Outlet.id).offset(skip).limit(limit).all()


@router.get("/{outlet_id}", response_model=OutletRead)
def get_outlet(outlet_id: int, db: Session = Depends(get_db)):
    if not profile_ready(db):
        found = legacy_outlets(db, 0, 1, outlet_id)
        if not found:
            raise HTTPException(status_code=404, detail="Outlet not found")
        return found[0]
    outlet = detail_query(db).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return outlet


def set_children(outlet: Outlet, data):
    outlet.contacts = [OutletContact(**contact.model_dump()) for contact in data.contacts]
    outlet.receiving_windows = [OutletReceivingWindow(**window.model_dump()) for window in data.receiving_windows]


@router.post("/", response_model=OutletRead, status_code=status.HTTP_201_CREATED)
def create_outlet(data: OutletCreate, db: Session = Depends(get_db), _: User = Depends(require_dispatcher_or_admin)):
    if not profile_ready(db):
        raise HTTPException(status_code=503, detail="Outlet profile migration has not been applied. Contact the DB lead before adding outlets.")
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
    if not profile_ready(db):
        raise HTTPException(status_code=503, detail="Outlet profile migration has not been applied. Contact the DB lead before editing outlets.")
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
