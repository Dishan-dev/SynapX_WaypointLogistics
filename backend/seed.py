import os
import sys
from dotenv import load_dotenv
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

# Ensure we can import app models
sys.path.append(os.path.dirname(__file__))
from app.models.user import User, UserRole
from app.models.fleet import Vehicle, DriverProfile, VehicleStatus
from app.models.allocation import Allocation, AllocationStatus

load_dotenv()
url = os.environ["DATABASE_URL_UNPOOLED"].replace("postgresql://", "postgresql+psycopg://", 1)
engine = sa.create_engine(url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Vehicle).count() > 0:
            print("Database already seeded. Skipping...")
            return

        print("Seeding database with Figma mock data...")
        
        # 1. Create Vehicles
        vehicles_data = [
            {"code": "VEH014", "vehicle_type": "Reefer 6T", "capacity_kg": 6000, "status": VehicleStatus.ALLOCATED},
            {"code": "VEH022", "vehicle_type": "Dry Box 6T", "capacity_kg": 6000, "status": VehicleStatus.AVAILABLE}, # marked as available, but ready in alloc
            {"code": "VEH031", "vehicle_type": "Reefer 6T", "capacity_kg": 6000, "status": VehicleStatus.AVAILABLE},
            {"code": "VEH041", "vehicle_type": "Dry Box 6T", "capacity_kg": 6000, "status": VehicleStatus.ALLOCATED},
            {"code": "VEH008", "vehicle_type": "Van 3.5T", "capacity_kg": 3500, "status": VehicleStatus.AVAILABLE},
            {"code": "VEH019", "vehicle_type": "Dry Box 10T", "capacity_kg": 10000, "status": VehicleStatus.UNAVAILABLE},
        ]
        
        vehicles = []
        for v in vehicles_data:
            vehicle = Vehicle(**v)
            db.add(vehicle)
            vehicles.append(vehicle)
        db.commit()

        # 2. Create Drivers (Users + DriverProfiles)
        drivers_data = [
            {"name": "Kasun Perera"},
            {"name": "Nimal Perera"},
            {"name": "Amal Fernando"},
            {"name": "Maintenance"}, # Dummy driver for maintenance
        ]
        
        drivers = []
        for d in drivers_data:
            user = User(
                email=f"{d['name'].replace(' ', '.').lower()}@waypoint.local",
                full_name=d["name"],
                hashed_password="mock",
                role=UserRole.DRIVER
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            profile = DriverProfile(
                user_id=user.id,
                license_type="Heavy",
                phone="0000000000"
            )
            db.add(profile)
            drivers.append(profile)
        db.commit()

        # 3. Create Allocations
        # VEH014 - Kasun Perera - 82% - RUN-024 - 06:00 - Allocated
        alloc1 = Allocation(
            vehicle_id=vehicles[0].id,
            driver_id=drivers[0].id,
            run_id="RUN-024",
            load_percentage=82,
            status=AllocationStatus.ALLOCATED
        )
        
        # VEH022 - Nimal Perera - 71% - RUN-018 - 08:30 - Ready
        alloc2 = Allocation(
            vehicle_id=vehicles[1].id,
            driver_id=drivers[1].id,
            run_id="RUN-018",
            load_percentage=71,
            status=AllocationStatus.READY
        )
        
        # VEH031 - Amal Fernando - 94% - RUN-029 - 09:00 - Review (Draft)
        alloc3 = Allocation(
            vehicle_id=vehicles[2].id,
            driver_id=drivers[2].id,
            run_id="RUN-029",
            load_percentage=94,
            status=AllocationStatus.DRAFT # Representing review
        )

        db.add_all([alloc1, alloc2, alloc3])
        db.commit()
        print("Seeding complete!")

    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
