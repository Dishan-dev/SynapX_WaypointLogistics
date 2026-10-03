import csv
import io
from typing import Any, List, Optional
from datetime import time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api import deps
from app.models.reference import Outlet, Brand, Depot, DockType
from app.schemas.outlet_settings import OutletSettingsRead, OutletSettingsUpdate
from app.schemas.admin import OutletRead, OutletCreate, OutletUpdate
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

            mall_window = norm_row.get("mall_window") or None

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
                existing_outlet.parking_constraint = parking_constraint
                existing_outlet.van_only = van_only
                existing_outlet.mall_window = mall_window
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
                    parking_constraint=parking_constraint,
                    van_only=van_only,
                    mall_window=mall_window,
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

@router.get("", response_model=List[OutletRead])
@router.get("/", response_model=List[OutletRead])
def get_outlets(
    q: Optional[str] = None,
    brand: Optional[str] = None,
    depot: Optional[str] = None,
    district: Optional[str] = None,
    van_only: Optional[bool] = None,
    skip: int = 0,
    limit: int = 150,
    db: Session = Depends(deps.get_db),
) -> Any:
    """List outlets with brand, district, depot, and dock type parameters."""
    query = db.query(Outlet)

    if brand:
        brand_clean = brand.lower()
        if brand_clean in Brand.__members__:
            query = query.filter(Outlet.brand == Brand[brand_clean])
        else:
            query = query.filter(Outlet.brand == brand_clean)

    if depot:
        depot_clean = depot.lower()
        if depot_clean in Depot.__members__:
            query = query.filter(Outlet.depot == Depot[depot_clean])
        else:
            query = query.filter(Outlet.depot == depot_clean)

    if district:
        query = query.filter(Outlet.district.ilike(f"%{district}%"))

    if van_only is not None:
        query = query.filter(Outlet.van_only == van_only)

    if q:
        search_pattern = f"%{q}%"
        query = query.filter(or_(Outlet.code.ilike(search_pattern), Outlet.name.ilike(search_pattern), Outlet.district.ilike(search_pattern)))

    outlets = query.order_by(Outlet.id.asc()).offset(skip).limit(limit).all()

    return [
        OutletRead(
            id=o.id,
            code=o.code,
            name=o.name,
            brand=o.brand.value.title() if hasattr(o.brand, "value") else str(o.brand).title(),
            district=o.district,
            dock_type=o.dock_type.value if hasattr(o.dock_type, "value") else str(o.dock_type),
            van_only=o.van_only,
            window_start=o.window_start.strftime("%H:%M") if o.window_start else "06:00",
            window_end=o.window_end.strftime("%H:%M") if o.window_end else "18:00",
            depot=o.depot.value.title() if hasattr(o.depot, "value") else str(o.depot).title(),
            parking_constraint=getattr(o, "parking_constraint", None) or ("van_only" if o.van_only else "normal"),
            mall_window=getattr(o, "mall_window", None),
        )
        for o in outlets
    ]


@router.post("", response_model=OutletRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=OutletRead, status_code=status.HTTP_201_CREATED)
def create_outlet(
    outlet_in: OutletCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Create a new outlet destination."""
    existing = db.query(Outlet).filter(Outlet.code == outlet_in.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Outlet with this code already exists.")

    brand_enum = Brand.FRESH
    b_val = outlet_in.brand.lower()
    if b_val in ("fresh", "style", "tech"):
        brand_enum = Brand(b_val)

    depot_enum = Depot.PELIYAGODA
    d_val = outlet_in.depot.lower()
    if d_val in ("peliyagoda", "kandy"):
        depot_enum = Depot(d_val)

    dock_enum = DockType.REAR_DOCK
    dk_val = outlet_in.dock_type.lower()
    if dk_val in ("rear_dock", "street", "mall_bay"):
        dock_enum = DockType(dk_val)

    w_start = None
    if outlet_in.window_start:
        parts = outlet_in.window_start.split(":")
        w_start = time(hour=int(parts[0]), minute=int(parts[1]))

    w_end = None
    if outlet_in.window_end:
        parts = outlet_in.window_end.split(":")
        w_end = time(hour=int(parts[0]), minute=int(parts[1]))

    new_outlet = Outlet(
        code=outlet_in.code.upper(),
        name=outlet_in.name,
        brand=brand_enum,
        district=outlet_in.district,
        dock_type=dock_enum,
        van_only=outlet_in.van_only,
        window_start=w_start,
        window_end=w_end,
        depot=depot_enum,
        parking_constraint=outlet_in.parking_constraint or ("van_only" if outlet_in.van_only else "normal"),
        mall_window=outlet_in.mall_window,
    )
    db.add(new_outlet)
    db.commit()
    db.refresh(new_outlet)

    return OutletRead(
        id=new_outlet.id,
        code=new_outlet.code,
        name=new_outlet.name,
        brand=new_outlet.brand.value.title() if hasattr(new_outlet.brand, "value") else str(new_outlet.brand).title(),
        district=new_outlet.district,
        dock_type=new_outlet.dock_type.value if hasattr(new_outlet.dock_type, "value") else str(new_outlet.dock_type),
        van_only=new_outlet.van_only,
        window_start=new_outlet.window_start.strftime("%H:%M") if new_outlet.window_start else "06:00",
        window_end=new_outlet.window_end.strftime("%H:%M") if new_outlet.window_end else "18:00",
        depot=new_outlet.depot.value.title() if hasattr(new_outlet.depot, "value") else str(new_outlet.depot).title(),
        parking_constraint=getattr(new_outlet, "parking_constraint", None) or ("van_only" if new_outlet.van_only else "normal"),
        mall_window=getattr(new_outlet, "mall_window", None),
    )


@router.put("/{outlet_id}", response_model=OutletRead)
def update_outlet(
    outlet_id: int,
    outlet_in: OutletUpdate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Update outlet parameters."""
    outlet = db.query(Outlet).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found.")

    if outlet_in.name is not None:
        outlet.name = outlet_in.name
    if outlet_in.code is not None:
        outlet.code = outlet_in.code.upper()
    if outlet_in.district is not None:
        outlet.district = outlet_in.district
    if outlet_in.van_only is not None:
        outlet.van_only = outlet_in.van_only
    if outlet_in.parking_constraint is not None:
        outlet.parking_constraint = outlet_in.parking_constraint
        if outlet_in.parking_constraint.lower() == "van_only":
            outlet.van_only = True
    if outlet_in.mall_window is not None:
        outlet.mall_window = outlet_in.mall_window

    if outlet_in.brand is not None:
        b_val = outlet_in.brand.lower()
        if b_val in ("fresh", "style", "tech"):
            outlet.brand = Brand(b_val)

    if outlet_in.depot is not None:
        d_val = outlet_in.depot.lower()
        if d_val in ("peliyagoda", "kandy"):
            outlet.depot = Depot(d_val)

    if outlet_in.dock_type is not None:
        dk_val = outlet_in.dock_type.lower()
        if dk_val in ("rear_dock", "street", "mall_bay"):
            outlet.dock_type = DockType(dk_val)

    if outlet_in.window_start is not None:
        parts = outlet_in.window_start.split(":")
        outlet.window_start = time(hour=int(parts[0]), minute=int(parts[1]))

    if outlet_in.window_end is not None:
        parts = outlet_in.window_end.split(":")
        outlet.window_end = time(hour=int(parts[0]), minute=int(parts[1]))

    db.commit()
    db.refresh(outlet)

    return OutletRead(
        id=outlet.id,
        code=outlet.code,
        name=outlet.name,
        brand=outlet.brand.value.title() if hasattr(outlet.brand, "value") else str(outlet.brand).title(),
        district=outlet.district,
        dock_type=outlet.dock_type.value if hasattr(outlet.dock_type, "value") else str(outlet.dock_type),
        van_only=outlet.van_only,
        window_start=outlet.window_start.strftime("%H:%M") if outlet.window_start else "06:00",
        window_end=outlet.window_end.strftime("%H:%M") if outlet.window_end else "18:00",
        depot=outlet.depot.value.title() if hasattr(outlet.depot, "value") else str(outlet.depot).title(),
        parking_constraint=getattr(outlet, "parking_constraint", None) or ("van_only" if outlet.van_only else "normal"),
        mall_window=getattr(outlet, "mall_window", None),
    )


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
