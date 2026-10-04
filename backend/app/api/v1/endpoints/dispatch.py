from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.api import deps
from app.models.shipment import DispatchTrip
from app.models.allocation import Allocation, AllocationStatus
from app.models.fleet import DriverProfile
from app.schemas.shipment import DispatchTripCreate, DispatchTripRead, DeliveryRunResponse, DeliveryRunUpdate, LoadingEventIn
from app.models.order import Order, OrderItem
from app.services.loader_service import RunNotBuildableError, loader_service
from app.schemas.loader import DispatcherPlanRequest


class PlanSyncRequest(BaseModel):
    plan: DispatcherPlanRequest
    stop_sequence: Optional[List[Dict[str, Any]]] = None

router = APIRouter()

def _with_loader(db: Session, trips: List[DispatchTrip]) -> List[DeliveryRunResponse]:
    views = loader_service.dispatcher_view(db, [t.id for t in trips])
    out = []
    for t in trips:
        item = DeliveryRunResponse.model_validate(t)
        view = views.get(t.id)
        item.loader = view.model_dump(mode="json") if view else None
        if view is not None:
            item.open_shortfalls = view.open_shortfalls
            item.stops_completed = view.stops_completed
            item.stop_count = view.stop_count
        if view is not None and not item.stop_sequence:
            dock_run = loader_service.run_for_dispatch_trip(db, t.id)
            if dock_run is not None:
                item.stop_sequence = _dock_stop_sequence(db, dock_run)
                item.stop_count = len(item.stop_sequence)
        if view is None:
            item.loader_warning = next(
                (event.get("note") for event in reversed(t.loading_events or [])
                 if event.get("event") == "Dock run unavailable"),
                None,
            )
        out.append(item)
    return out


def _dock_stop_sequence(db: Session, dock_run) -> List[Dict[str, Any]]:
    return [
        {"id": stop.outlet.code, "outlet_code": stop.outlet.code,
         "name": stop.outlet.name, "eta": stop.eta.isoformat() if stop.eta else "",
         "sla_ok": True, "sla_note": "On schedule"}
        for stop in sorted(loader_service.current_stops(db, dock_run), key=lambda stop: stop.stop_sequence)
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _compute_sync_status(run: DispatchTrip) -> dict:
    """
    Derive driver sync health from the run's metadata.
    A real implementation would use a websocket heartbeat table;
    here we infer from the loading_events and updated_at timestamp.
    """
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    updated = run.updated_at

    # Make updated_at timezone-aware if it isn't
    if updated and updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)

    stale_threshold = timedelta(minutes=15)
    conflict_threshold = timedelta(minutes=30)

    if updated is None:
        sync_status = "unknown"
    elif now - updated > conflict_threshold:
        sync_status = "conflict"
    elif now - updated > stale_threshold:
        sync_status = "degraded"
    else:
        sync_status = "ok"

    last_update_mins = int((now - updated).total_seconds() / 60) if updated else None
    return {
        "sync_status": sync_status,
        "last_update_mins": last_update_mins,
    }


@router.get("/", response_model=List[DeliveryRunResponse])
def list_delivery_runs(
    status: Optional[str] = None,
    depot: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db)
):
    query = db.query(DispatchTrip)
    if status:
        query = query.filter(DispatchTrip.status == status)
    if depot:
        query = query.filter(DispatchTrip.depot_name == depot)
    
    trips = query.offset(skip).limit(limit).all()
    return _with_loader(db, trips)


@router.get("/live")
def get_live_runs(db: Session = Depends(deps.get_db)):
    """
    Returns all actively moving runs (en_route) enriched with sync health status.
    Used by the Live Tracking page to show real-time dispatcher visibility.
    """
    runs = (
        db.query(DispatchTrip)
        .filter(DispatchTrip.status.in_(["en_route", "scheduled", "ready"]))
        .order_by(DispatchTrip.departure_time.asc())
        .all()
    )

    result = []
    for run in runs:
        sync = _compute_sync_status(run)
        result.append({
            "id": run.id,
            "trip_code": run.trip_code,
            "vehicle_number": run.vehicle_number,
            "driver_name": run.driver_name,
            "depot_name": run.depot_name,
            "origin": run.origin,
            "destination": run.destination,
            "status": run.status,
            "departure_time": run.departure_time.isoformat() if run.departure_time else None,
            "estimated_arrival": run.estimated_arrival.isoformat() if run.estimated_arrival else None,
            "stop_count": run.stop_count,
            "stops_completed": run.stops_completed,
            "stop_sequence": run.stop_sequence or [],
            "open_shortfalls": run.open_shortfalls,
            "loading_events": run.loading_events or [],
            "total_weight_kg": run.total_weight_kg,
            "total_volume_m3": run.total_volume_m3,
            "updated_at": run.updated_at.isoformat() if run.updated_at else None,
            # Enriched fields
            "sync_status": sync["sync_status"],
            "last_update_mins": sync["last_update_mins"],
        })
    return result


@router.get("/{id}", response_model=DeliveryRunResponse)
def get_delivery_run(id: int, db: Session = Depends(deps.get_db)):
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Delivery run not found")
    return _with_loader(db, [run])[0]


@router.post("/", response_model=DeliveryRunResponse, status_code=status.HTTP_201_CREATED)
def create_delivery_run(
    trip_in: DispatchTripCreate,
    db: Session = Depends(deps.get_db),
    # current_user = Depends(deps.require_dispatcher_or_admin)
):
    trip = DispatchTrip(**trip_in.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{id}", response_model=DeliveryRunResponse)
def update_delivery_run(
    id: int,
    trip_in: DeliveryRunUpdate,
    db: Session = Depends(deps.get_db),
    # current_user = Depends(deps.require_dispatcher_or_admin)
):
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Delivery run not found")

    update_data = trip_in.model_dump(exclude_unset=True)
    if update_data.get("status") == "en_route" and run.allocation_id and not loader_service.run_for_dispatch_trip(db, run.id):
        raise HTTPException(status_code=409, detail="Send the run to a dock before publishing it")
    for field, value in update_data.items():
        setattr(run, field, value)

    # Explicitly touch updated_at — onupdate lambda only fires on DB-level flush
    run.updated_at = datetime.now(timezone.utc)

    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.post("/{id}/plan", response_model=DeliveryRunResponse)
def sync_delivery_plan(id: int, payload: PlanSyncRequest, db: Session = Depends(deps.get_db)):
    """Publish the dock plan and update its dispatch trip in one transaction."""
    trip = db.query(DispatchTrip).filter(DispatchTrip.id == id).with_for_update().first()
    if trip is None:
        raise HTTPException(status_code=404, detail="Delivery run not found")

    if payload.stop_sequence is not None:
        codes = [stop.get("outlet_code") for stop in payload.stop_sequence]
        if not codes or any(not code for code in codes) or codes != payload.plan.stop_order:
            raise HTTPException(status_code=422, detail="Stop sequence must match the outlet codes in the dock plan")

    loader_run = loader_service.run_for_dispatch_trip(db, trip.id)
    if loader_run is not None:
        loader_service.publish_dispatcher_plan(db, loader_run, payload.plan)
    elif payload.stop_sequence is not None:
        raise HTTPException(status_code=409, detail="No dock run exists for this trip")

    if payload.stop_sequence is not None:
        trip.stop_sequence = payload.stop_sequence
        trip.stop_count = len(payload.stop_sequence)
    if payload.plan.departs_at is not None:
        trip.departure_time = payload.plan.departs_at
    trip.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return _with_loader(db, [trip])[0]


@router.post("/from-allocation/{allocation_id}", response_model=DeliveryRunResponse, status_code=status.HTTP_201_CREATED)
def create_run_from_allocation(
    allocation_id: int,
    db: Session = Depends(deps.get_db),
    # current_user = Depends(deps.require_dispatcher_or_admin)
):
    """
    Dispatch an allocation: atomically creates a DispatchTrip (Delivery Run)
    from an existing allocation and marks the allocation as DISPATCHED.
    Idempotent — if a run already exists for this allocation, returns it.
    """
    allocation = (
        db.query(Allocation)
        .options(joinedload(Allocation.vehicle), joinedload(Allocation.driver).joinedload(DriverProfile.user))
        .filter(Allocation.id == allocation_id)
        .first()
    )
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    # A retry returns the trip, including any dock warning, even after the
    # allocation has been marked DISPATCHED.
    existing = db.query(DispatchTrip).filter(DispatchTrip.allocation_id == allocation_id).first()
    if existing:
        return _with_loader(db, [existing])[0]

    # Only allow dispatching from READY or LOADING states
    if allocation.status not in (AllocationStatus.READY, AllocationStatus.LOADING):
        raise HTTPException(
            status_code=400,
            detail=f"Allocation must be READY or LOADING to dispatch (current: {allocation.status})"
        )

    # Build the trip code from the allocation's run_id or generate one
    trip_code = allocation.run_id or f"RUN-{allocation_id:04d}"

    # Resolve driver name from the linked DriverProfile → User
    driver_name = "Unassigned"
    if allocation.driver and allocation.driver.user:
        driver_name = allocation.driver.user.full_name or "Unassigned"

    # Resolve vehicle fields
    vehicle = allocation.vehicle
    vehicle_number = vehicle.code if vehicle else "UNKNOWN"
    depot_name = vehicle.depot_name if vehicle else None

    trip = DispatchTrip(
        trip_code=trip_code,
        allocation_id=allocation.id,
        vehicle_id=allocation.vehicle_id,
        driver_id=allocation.driver_id,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        origin=depot_name or "depot",
        destination="multiple stops",
        depot_name=depot_name,
        status="scheduled",
        departure_time=allocation.departure_time,
        total_weight_kg=0.0,
        total_volume_m3=0.0,
        stop_count=0,
        stops_completed=0,
        stop_sequence=[],
        open_shortfalls=0,
        loading_events=[
            {
                "event": "Dispatch trip created",
                "time": datetime.now(timezone.utc).strftime("%H:%M"),
                "note": f"Dispatched from allocation #{allocation_id}",
                "status": "ok"
            }
        ],
    )
    db.add(trip)

    # Mark allocation as dispatched
    allocation.status = AllocationStatus.DISPATCHED
    db.add(allocation)

    db.flush()
    try:
        with db.begin_nested():
            dock_run = loader_service.create_run_for_dispatch_trip(db, trip)
    except RunNotBuildableError as exc:
        reasons = "; ".join(v["message"] for v in exc.details.get("violations", []))
        warning = reasons or str(exc)
        trip.loading_events = [
            *(trip.loading_events or []),
            {"event": "Dock run unavailable", "time": datetime.now(timezone.utc).strftime("%H:%M"),
             "note": warning, "status": "warning"},
        ]
    else:
        trip.stop_sequence = _dock_stop_sequence(db, dock_run)
        trip.stop_count = len(trip.stop_sequence)
        trip.loading_events = [
            *(trip.loading_events or []),
            {"event": "Dock plan published", "time": datetime.now(timezone.utc).strftime("%H:%M"),
             "note": f"Sent to {dock_run.dock.name}", "status": "ok"},
        ]

    db.commit()
    db.refresh(trip)
    return _with_loader(db, [trip])[0]


@router.post("/{id}/add-loading-event", response_model=DeliveryRunResponse)
def add_loading_event(
    id: int,
    event_in: LoadingEventIn,
    db: Session = Depends(deps.get_db),
):
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    events = list(run.loading_events or [])
    events.append(event_in.model_dump())
    run.loading_events = events
    run.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(run)
    return run


@router.post("/{id}/send-to-exceptions", response_model=DeliveryRunResponse)
def send_to_exceptions(
    id: int,
    db: Session = Depends(deps.get_db),
):
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    now_str = datetime.now(timezone.utc).strftime("%H:%M")
    events = list(run.loading_events or [])
    events.append({
        "event": "Sent to exceptions",
        "time": now_str,
        "note": "Shortfall escalated by dispatcher",
        "status": "warning"
    })
    run.loading_events = events
    run.open_shortfalls = 0
    run.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(run)
    return run


@router.get("/{id}/manifest")
def get_manifest(
    id: int,
    db: Session = Depends(deps.get_db),
):
    """
    Returns the manifest for a delivery run — all orders assigned to the
    allocation that created this run, with their line items.
    """
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if not run.allocation_id:
        return {
            "run_id": id,
            "trip_code": run.trip_code,
            "orders": [],
            "total_weight_kg": run.total_weight_kg,
            "total_volume_m3": run.total_volume_m3,
        }

    orders = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.allocation_id == run.allocation_id)
        .all()
    )

    orders_payload = []
    for o in orders:
        orders_payload.append({
            "id": o.id,
            "order_number": o.order_number,
            "client_name": o.client_name,
            "destination_address": o.destination_address,
            "status": o.status.value if hasattr(o.status, 'value') else str(o.status),
            "total_amount": o.total_amount,
            "items": [
                {
                    "sku": item.sku,
                    "item_name": item.item_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                }
                for item in o.items
            ],
        })

    return {
        "run_id": id,
        "trip_code": run.trip_code,
        "vehicle_number": run.vehicle_number,
        "driver_name": run.driver_name,
        "departure_time": run.departure_time.isoformat() if run.departure_time else None,
        "orders": orders_payload,
        "total_weight_kg": run.total_weight_kg,
        "total_volume_m3": run.total_volume_m3,
        "stop_sequence": run.stop_sequence or [],
    }


@router.post("/{id}/mark-stop-complete", response_model=DeliveryRunResponse)
def mark_stop_complete(
    id: int,
    db: Session = Depends(deps.get_db),
):
    """
    Increment stops_completed by 1. Automatically marks the run as 'completed'
    when all stops are done.
    """
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.stops_completed < run.stop_count:
        run.stops_completed += 1

    # Auto-complete the run when all stops are done
    if run.stop_count > 0 and run.stops_completed >= run.stop_count:
        run.status = "completed"
        run.actual_arrival = datetime.now(timezone.utc)

    run.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(run)
    return run


@router.post("/{id}/recall-run", response_model=DeliveryRunResponse)
def recall_run(
    id: int,
    db: Session = Depends(deps.get_db),
):
    """
    Dispatcher initiates a run recall — marks run status as 'recalled' and logs
    a loading event. This is a high-severity action used in sync conflict resolution.
    """
    run = db.query(DispatchTrip).filter(DispatchTrip.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    now_str = datetime.now(timezone.utc).strftime("%H:%M")
    events = list(run.loading_events or [])
    events.append({
        "event": "Run recalled",
        "time": now_str,
        "note": "Dispatcher issued a recall due to sync conflict",
        "status": "error"
    })
    run.loading_events = events
    run.status = "recalled"
    run.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(run)
    return run
