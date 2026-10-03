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
from app.models.outlet_settings import OutletSettings
from app.models.user import User
from app.schemas.outlet_settings import OutletSettingsRead, OutletSettingsUpdate
from app.schemas.admin import OutletRead, OutletCreate, OutletUpdate, OutletManagerAssignRequest
from app.services.outlet_service import outlet_service

router = APIRouter()

def outlet_to_read(o: Outlet, s: Optional[OutletSettings] = None, user_id: Optional[int] = None) -> OutletRead:
    return OutletRead(
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
        store_manager=s.store_manager if s else None,
        store_manager_user_id=user_id,
        store_manager_phone=s.contact_phone if s else None,
    )

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

    outlet_ids = [o.id for o in outlets]
    settings_map = {}
    if outlet_ids:
        records = db.query(OutletSettings).filter(OutletSettings.outlet_id.in_(outlet_ids)).all()
        settings_map = {rec.outlet_id: rec for rec in records}

    users = db.query(User).filter(User.role.in_(["WAREHOUSE_MANAGER", "ADMIN"])).all()
    user_name_to_id = {u.full_name.strip().lower(): u.id for u in users if u.full_name}

    results = []
    for o in outlets:
        s = settings_map.get(o.id)
        mgr_name = s.store_manager.strip().lower() if (s and s.store_manager) else None
        u_id = user_name_to_id.get(mgr_name) if mgr_name else None
        results.append(outlet_to_read(o, s, u_id))
    return results


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

    settings = None
    if outlet_in.store_manager or outlet_in.store_manager_phone:
        settings = OutletSettings(
            outlet_id=new_outlet.id,
            store_manager=outlet_in.store_manager,
            contact_phone=outlet_in.store_manager_phone or "077-0000000",
            parking="No restrictions",
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    u_id = None
    if settings and settings.store_manager:
        matched_user = db.query(User).filter(User.full_name.ilike(settings.store_manager.strip())).first()
        if matched_user:
            u_id = matched_user.id

    return outlet_to_read(new_outlet, settings, u_id)


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

    settings = db.query(OutletSettings).filter(OutletSettings.outlet_id == outlet.id).first()
    if outlet_in.store_manager is not None or outlet_in.store_manager_phone is not None:
        if not settings:
            settings = OutletSettings(
                outlet_id=outlet.id,
                store_manager=outlet_in.store_manager,
                contact_phone=outlet_in.store_manager_phone or "077-0000000",
                parking="No restrictions",
            )
            db.add(settings)
        else:
            if outlet_in.store_manager is not None:
                settings.store_manager = outlet_in.store_manager
            if outlet_in.store_manager_phone is not None:
                settings.contact_phone = outlet_in.store_manager_phone

    db.commit()
    db.refresh(outlet)
    if settings:
        db.refresh(settings)

    u_id = None
    if settings and settings.store_manager:
        matched_user = db.query(User).filter(User.full_name.ilike(settings.store_manager.strip())).first()
        if matched_user:
            u_id = matched_user.id

    return outlet_to_read(outlet, settings, u_id)


@router.post("/{outlet_id}/assign-manager", response_model=OutletRead)
def assign_outlet_manager(
    outlet_id: int,
    payload: OutletManagerAssignRequest,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Assign or unassign a store manager for an outlet.
    """
    outlet = db.query(Outlet).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    manager_name = payload.store_manager
    manager_phone = payload.contact_phone
    user_id = payload.user_id

    if user_id is not None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Store manager user account not found")
        manager_name = user.full_name
        if not manager_phone:
            manager_phone = "077-0000000"

    settings = db.query(OutletSettings).filter(OutletSettings.outlet_id == outlet.id).first()
    if not settings:
        settings = OutletSettings(
            outlet_id=outlet.id,
            store_manager=manager_name,
            contact_phone=manager_phone or "077-0000000",
            parking="No restrictions",
        )
        db.add(settings)
    else:
        settings.store_manager = manager_name
        if manager_phone is not None:
            settings.contact_phone = manager_phone

    db.commit()
    db.refresh(settings)

    try:
        from app.api.v1.endpoints.admin import record_audit
        record_audit(
            action_type="OUTLET_MUTATION",
            entity_name="Outlet Manager Assignment",
            entity_id=str(outlet.id),
            summary=f"Assigned store manager '{manager_name or 'Unassigned'}' to outlet {outlet.code}.",
            severity="INFO",
        )
    except Exception:
        pass

    return outlet_to_read(outlet, settings, user_id)


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
