import os
import sys
from datetime import datetime, timezone, timedelta

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.shipment import DispatchTrip
from app.models.driver import DriverTrip, DeliveryStop, DeliveryStopStatus

def seed_driver_data(db: Session):
    print("Seeding driver data...")
    
    # 1. Create a driver user
    driver_email = "driver@waypoint.com"
    driver = db.query(User).filter(User.email == driver_email).first()
    if not driver:
        driver = User(
            email=driver_email,
            full_name="John Doe",
            hashed_password=get_password_hash("driver123"),
            role=UserRole.DRIVER,
            is_active=True
        )
        db.add(driver)
        db.commit()
        db.refresh(driver)
        print(f"Created driver: {driver.email}")
    else:
        print(f"Driver {driver.email} already exists")

    # 2. Create a DispatchTrip for today
    dispatch = db.query(DispatchTrip).filter(DispatchTrip.trip_code == "DT-TODAY-001").first()
    if not dispatch:
        dispatch = DispatchTrip(
            trip_code="DT-TODAY-001",
            vehicle_number="TRK-900",
            driver_name="John Doe",
            origin="Central Depot",
            destination="Downtown Region",
            departure_time=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db.add(dispatch)
        db.commit()
        db.refresh(dispatch)
        print("Created dispatch trip: DT-TODAY-001")
    else:
        print("Dispatch trip already exists")

    # 3. Create a DriverTrip
    driver_trip = db.query(DriverTrip).filter(DriverTrip.dispatch_trip_id == dispatch.id).first()
    if not driver_trip:
        driver_trip = DriverTrip(
            driver_id=driver.id,
            dispatch_trip_id=dispatch.id
        )
        db.add(driver_trip)
        db.commit()
        db.refresh(driver_trip)
        print("Created DriverTrip")
    else:
        print("DriverTrip already exists")

    # 4. Create DeliveryStops
    if not db.query(DeliveryStop).filter(DeliveryStop.driver_trip_id == driver_trip.id).first():
        stops = [
            DeliveryStop(
                driver_trip_id=driver_trip.id,
                sequence=1,
                address="123 Main St, Downtown",
                customer_name="Alice Smith",
                customer_phone="555-0101",
                latitude=40.7128,
                longitude=-74.0060,
                notes="Leave at front desk"
            ),
            DeliveryStop(
                driver_trip_id=driver_trip.id,
                sequence=2,
                address="456 Elm St, Downtown",
                customer_name="Bob Jones",
                customer_phone="555-0102",
                latitude=40.7138,
                longitude=-74.0050,
                notes="Fragile items"
            ),
            DeliveryStop(
                driver_trip_id=driver_trip.id,
                sequence=3,
                address="789 Oak Ave, Uptown",
                customer_name="Charlie Brown",
                customer_phone="555-0103",
                latitude=40.7200,
                longitude=-74.0100
            )
        ]
        db.add_all(stops)
        db.commit()
        print("Created 3 DeliveryStops")
    else:
        print("DeliveryStops already exist")
        
    print("Seeding complete! You can log in with driver@waypoint.com / driver123")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_driver_data(db)
    finally:
        db.close()
