from typing import Any, List, Optional
from datetime import time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api import deps
from app.models.reference import Outlet, Brand, Depot, DockType
from app.schemas.outlet_settings import OutletSettingsRead, OutletSettingsUpdate
from app.schemas.admin import OutletRead, OutletCreate, OutletUpdate
from app.services.outlet_service import outlet_service

router = APIRouter()


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
