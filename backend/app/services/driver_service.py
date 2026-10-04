from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.driver import DriverTrip, DeliveryStop, ProofOfDelivery, DriverTripStatus, DeliveryStopStatus
from app.models.shipment import DispatchTrip
from app.email.service import queue_driver_issue, queue_sos


def get_today_trips(db: Session, driver_id: int) -> List[DriverTrip]:
    today = datetime.now(timezone.utc).date()
    return db.query(DriverTrip).filter(
        DriverTrip.driver_id == driver_id,
        DriverTrip.assigned_date == today
    ).all()


def get_trip_detail(db: Session, trip_id: int, driver_id: int) -> DriverTrip:
    trip = db.query(DriverTrip).filter(
        DriverTrip.id == trip_id,
        DriverTrip.driver_id == driver_id
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")
    return trip


def start_trip(db: Session, trip_id: int, driver_id: int) -> DriverTrip:
    trip = get_trip_detail(db, trip_id, driver_id)
    if trip.status != DriverTripStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail=f"Cannot start trip with status {trip.status}")
    
    trip.status = DriverTripStatus.STARTED
    trip.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip


def complete_trip(db: Session, trip_id: int, driver_id: int) -> DriverTrip:
    trip = get_trip_detail(db, trip_id, driver_id)
    if trip.status != DriverTripStatus.STARTED:
        raise HTTPException(status_code=400, detail="Trip is not started")
    
    # Verify all stops are in terminal state
    terminal_states = [DeliveryStopStatus.DELIVERED, DeliveryStopStatus.FAILED, DeliveryStopStatus.RESCHEDULED]
    for stop in trip.stops:
        if stop.status not in terminal_states:
            raise HTTPException(status_code=400, detail=f"Stop {stop.id} is not in a terminal state")
            
    trip.status = DriverTripStatus.COMPLETED
    trip.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip


def get_stop(db: Session, stop_id: int, driver_id: int) -> DeliveryStop:
    stop = db.query(DeliveryStop).join(DriverTrip).filter(
        DeliveryStop.id == stop_id,
        DriverTrip.driver_id == driver_id
    ).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    return stop


def record_arrival(db: Session, stop_id: int, driver_id: int) -> DeliveryStop:
    stop = get_stop(db, stop_id, driver_id)
    if stop.status != DeliveryStopStatus.PENDING:
        raise HTTPException(status_code=400, detail="Stop is not pending")
    
    stop.status = DeliveryStopStatus.ARRIVED
    stop.arrived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(stop)
    return stop


def record_outcome(db: Session, stop_id: int, outcome: DeliveryStopStatus, driver_id: int) -> DeliveryStop:
    stop = get_stop(db, stop_id, driver_id)
    if stop.status not in [DeliveryStopStatus.ARRIVED, DeliveryStopStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Must arrive at stop first (or be pending)")
        
    valid_outcomes = [DeliveryStopStatus.DELIVERED, DeliveryStopStatus.FAILED, DeliveryStopStatus.PARTIAL, DeliveryStopStatus.RESCHEDULED]
    if outcome not in valid_outcomes:
        raise HTTPException(status_code=400, detail="Invalid outcome")
        
    stop.status = outcome
    db.commit()
    db.refresh(stop)
    return stop


def submit_pod(db: Session, stop_id: int, pod_data: dict, driver_id: int) -> ProofOfDelivery:
    stop = get_stop(db, stop_id, driver_id)
    if stop.status != DeliveryStopStatus.DELIVERED and stop.status != DeliveryStopStatus.PARTIAL:
        raise HTTPException(status_code=400, detail="Outcome must be delivered or partial before POD")
        
    existing_pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.stop_id == stop.id).first()
    if existing_pod:
        raise HTTPException(status_code=400, detail="POD already exists for this stop")
        
    pod = ProofOfDelivery(
        stop_id=stop.id,
        recipient_name=pod_data["recipient_name"],
        signature_data=pod_data.get("signature_data"),
        photo_url=pod_data.get("photo_url"),
        notes=pod_data.get("notes")
    )
    db.add(pod)
    
    # Auto complete the stop when POD is submitted
    stop.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(pod)
    return pod


def complete_stop(db: Session, stop_id: int, driver_id: int) -> DeliveryStop:
    stop = get_stop(db, stop_id, driver_id)
    
    # If outcome is delivered, ensure POD exists
    if stop.status in [DeliveryStopStatus.DELIVERED, DeliveryStopStatus.PARTIAL]:
        if not stop.pod:
            raise HTTPException(status_code=400, detail="POD required before completing stop")
            
    if stop.status not in [DeliveryStopStatus.DELIVERED, DeliveryStopStatus.FAILED, DeliveryStopStatus.PARTIAL, DeliveryStopStatus.RESCHEDULED]:
        raise HTTPException(status_code=400, detail="Outcome must be set before completing stop")
        
    stop.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(stop)
    return stop


from app.models.driver import IssueReport, SOSAlert, IssueStatus, SOSStatus

def report_issue(db: Session, trip_id: int, issue_data: dict, driver_id: int) -> IssueReport:
    trip = get_trip_detail(db, trip_id, driver_id)
    
    stop_id = issue_data.get("stop_id")
    if stop_id:
        # Validate stop belongs to this trip
        stop = db.query(DeliveryStop).filter(
            DeliveryStop.id == stop_id, 
            DeliveryStop.driver_trip_id == trip.id
        ).first()
        if not stop:
            raise HTTPException(status_code=400, detail="Stop does not belong to this trip")
            
    issue = IssueReport(
        driver_trip_id=trip.id,
        stop_id=stop_id,
        issue_type=issue_data["issue_type"],
        description=issue_data["description"],
        photo_url=issue_data.get("photo_url")
    )
    db.add(issue)
    db.flush()
    queue_driver_issue(db, issue)
    db.commit()
    db.refresh(issue)
    return issue


def get_trip_issues(db: Session, trip_id: int, driver_id: int) -> List[IssueReport]:
    trip = get_trip_detail(db, trip_id, driver_id)
    return trip.issues


def trigger_sos(db: Session, driver_id: int, sos_data: dict) -> SOSAlert:
    trip_id = sos_data.get("driver_trip_id")
    if trip_id:
        # verify trip belongs to driver
        get_trip_detail(db, trip_id, driver_id)
        
    alert = SOSAlert(
        driver_id=driver_id,
        driver_trip_id=trip_id,
        latitude=sos_data.get("latitude"),
        longitude=sos_data.get("longitude"),
        message=sos_data.get("message")
    )
    db.add(alert)
    db.flush()
    queue_sos(db, alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_sos(db: Session, alert_id: int, driver_id: int) -> SOSAlert:
    alert = db.query(SOSAlert).filter(
        SOSAlert.id == alert_id,
        SOSAlert.driver_id == driver_id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS Alert not found")
    return alert


def depot_checkin(db: Session, trip_id: int, driver_id: int) -> DriverTrip:
    trip = get_trip_detail(db, trip_id, driver_id)
    if trip.status == DriverTripStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Trip hasn't started yet")
        
    if trip.status != DriverTripStatus.COMPLETED:
        trip.status = DriverTripStatus.COMPLETED
        trip.completed_at = datetime.now(timezone.utc)
        
    db.commit()
    db.refresh(trip)
    return trip


def process_sync_batch(db: Session, actions: list, driver_id: int) -> dict:
    processed_count = 0
    conflicts = []
    
    for action in actions:
        try:
            if action.action_type == "arrive":
                record_arrival(db, action.stop_id, driver_id)
            elif action.action_type == "outcome":
                record_outcome(db, action.stop_id, action.payload["outcome"], driver_id)
            elif action.action_type == "pod":
                submit_pod(db, action.stop_id, action.payload, driver_id)
            elif action.action_type == "complete":
                complete_stop(db, action.stop_id, driver_id)
            elif action.action_type == "issue":
                report_issue(db, action.trip_id, action.payload, driver_id)
            
            processed_count += 1
            
        except HTTPException as e:
            # If a stop fails validation (e.g. already delivered), log as conflict
            conflicts.append({
                "action_id": action.action_id,
                "stop_id": action.stop_id,
                "reason": e.detail,
                "server_state": {"status": e.status_code}
            })
        except Exception as e:
            conflicts.append({
                "action_id": action.action_id,
                "stop_id": action.stop_id,
                "reason": str(e),
                "server_state": {}
            })
            
    return {
        "processed_count": processed_count,
        "conflicts": conflicts
    }


