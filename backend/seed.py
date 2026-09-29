import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(__file__))
from app.models.user import User, UserRole
from app.models.fleet import Vehicle, DriverProfile, VehicleStatus
from app.models.allocation import Allocation, AllocationStatus
from app.models.order import Order, OrderItem, OrderStatus

from app.core.config import settings

url = settings.DATABASE_URL_UNPOOLED or settings.DATABASE_URL
engine = sa.create_engine(url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def today_at(hour: int, minute: int = 0) -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


def wipe(db):
    """Delete all seed data cleanly so re-seeding is idempotent."""
    print("Wiping existing seed data...")
    db.execute(sa.text("DELETE FROM order_items"))
    db.execute(sa.text("DELETE FROM orders"))
    db.execute(sa.text("DELETE FROM allocations"))
    db.execute(sa.text("DELETE FROM driver_profiles"))
    db.execute(sa.text("DELETE FROM vehicles"))
    # The pg enum label is uppercase ('DRIVER') — match exactly
    db.execute(sa.text("DELETE FROM users WHERE role::text = 'DRIVER'"))
    db.commit()
    print("Wipe complete.")


def seed():
    db = SessionLocal()
    try:
        wipe(db)
        print("Seeding representative data for all allocation statuses...")

        # ── 1. Vehicles ───────────────────────────────────────────────────────
        vehicles_raw = [
            #  code       type      kg      vol   status                      temp       depot           fuel                t_day  t_plan  maint
            ("VEH014", "truck",  6000, 24.0, VehicleStatus.ALLOCATED,    "reefer",  "peliyagoda",   "Within quota",     1,     2,      None),
            ("VEH022", "truck",  6000, 20.0, VehicleStatus.ALLOCATED,    "ambient", "peliyagoda",   "Within quota",     1,     2,      None),
            ("VEH031", "truck",  6000, 24.0, VehicleStatus.ALLOCATED,    "reefer",  "peliyagoda",   "Within quota",     1,     2,      None),
            ("VEH041", "truck",  6000, 20.0, VehicleStatus.ALLOCATED,    "ambient", "peliyagoda",   "Within quota",     0,     1,      None),
            ("VEH008", "van",    3500, 12.0, VehicleStatus.ALLOCATED,    "ambient", "peliyagoda",   "Within quota",     0,     1,      None),
            ("VEH033", "truck", 10000, 36.0, VehicleStatus.ALLOCATED,    "reefer",  "kandy",        "Exceeded quota",   2,     3,      None),
            ("VEH055", "van",    3500, 12.0, VehicleStatus.AVAILABLE,    "ambient", "kandy",        "Within quota",     0,     0,      None),
            ("VEH019", "truck", 10000, 36.0, VehicleStatus.UNAVAILABLE,  "ambient", "peliyagoda",   "Within quota",     0,     0,      "Under maintenance"),
        ]

        vehicles = []
        for code, vtype, kg, vol, status, temp, depot, fuel, t_day, t_plan, maint in vehicles_raw:
            v = Vehicle(
                code=code, vehicle_type=vtype,
                capacity_kg=kg, capacity_vol_m3=vol,
                status=status,
                temperature_mode=temp, depot_name=depot,
                weekly_fuel_status=fuel,
                trips_today=t_day, trips_planned=t_plan,
                maintenance_state=maint,
            )
            db.add(v)
            vehicles.append(v)
        db.commit()
        for v in vehicles:
            db.refresh(v)

        # ── 2. Drivers ────────────────────────────────────────────────────────
        driver_specs = [
            ("Kasun Perera",  "kasun.perera",  "Heavy"),
            ("Nimal Perera",  "nimal.perera",  "Heavy"),
            ("Amal Fernando", "amal.fernando", "Medium"),
            ("Ruwan Silva",   "ruwan.silva",   "Heavy"),
        ]

        drivers = []
        for name, email_prefix, lic in driver_specs:
            user = User(
                email=f"{email_prefix}@waypoint.com",
                full_name=name,
                hashed_password="mock",
                role=UserRole.DRIVER,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            profile = DriverProfile(user_id=user.id, license_type=lic, phone="0771000000")
            db.add(profile)
            drivers.append(profile)
        db.commit()

        # ── 3. Allocations — one per status ───────────────────────────────────
        allocations = [
            # DRAFT — high utilisation, needs review before keeping
            Allocation(
                vehicle_id=vehicles[0].id, driver_id=drivers[0].id,
                run_id="RUN-029", load_percentage=94, volume_percentage=88,
                departure_time=today_at(9), status=AllocationStatus.DRAFT,
            ),
            # ALLOCATED — confirmed by dispatcher, pending readiness check
            Allocation(
                vehicle_id=vehicles[1].id, driver_id=drivers[1].id,
                run_id="RUN-024", load_percentage=82, volume_percentage=74,
                departure_time=today_at(6), status=AllocationStatus.ALLOCATED,
            ),
            # READY — cleared for dispatch, waiting at dock
            Allocation(
                vehicle_id=vehicles[2].id, driver_id=drivers[2].id,
                run_id="RUN-018", load_percentage=71, volume_percentage=63,
                departure_time=today_at(8, 30), status=AllocationStatus.READY,
            ),
            # LOADING — warehouse actively loading goods onto vehicle
            Allocation(
                vehicle_id=vehicles[3].id, driver_id=None,
                run_id="RUN-011", load_percentage=58, volume_percentage=50,
                departure_time=today_at(7), status=AllocationStatus.LOADING,
            ),
            # DISPATCHED — vehicle left depot, en route
            Allocation(
                vehicle_id=vehicles[4].id, driver_id=drivers[3].id,
                run_id="RUN-005", load_percentage=65, volume_percentage=60,
                departure_time=today_at(5, 30), status=AllocationStatus.DISPATCHED,
            ),
            # COMPLETED — delivery done, vehicle freed (terminal)
            Allocation(
                vehicle_id=vehicles[5].id, driver_id=drivers[0].id,
                run_id="RUN-001", load_percentage=78, volume_percentage=70,
                departure_time=today_at(4), status=AllocationStatus.COMPLETED,
            ),
            # UNAVAILABLE — vehicle blocked by maintenance
            Allocation(
                vehicle_id=vehicles[7].id, driver_id=None,
                run_id=None, load_percentage=0, volume_percentage=0,
                departure_time=None, status=AllocationStatus.UNAVAILABLE,
            ),
            # AVAILABLE — spare vehicle, no active allocation
            Allocation(
                vehicle_id=vehicles[6].id, driver_id=None,
                run_id=None, load_percentage=0, volume_percentage=0,
                departure_time=None, status=AllocationStatus.AVAILABLE,
            ),
        ]

        db.add_all(allocations)
        db.commit()
        for a in allocations:
            db.refresh(a)

        # ── 4. Orders ─────────────────────────────────────────────────────────
        orders_raw = [
            # num, client, addr, brand, district, temp, window, kg, status, is_prio, is_late, alloc_idx, def_reason
            ("ORD-1001", "Fresh Mart - Nugegoda", "High Level Rd, Nugegoda", "Fresh", "Colombo", "Chilled", "05:30–07:30", 420.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1002", "Fresh Mart - Kandy", "Peradeniya Rd, Kandy", "Fresh", "Kandy", "Chilled", "06:00–08:00", 380.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1003", "Style Hub - OGF", "Galle Face, Colombo 03", "Style", "Colombo", "Ambient", "10:00–12:00", 240.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1004", "Waypoint Tech - Maharagama", "Old Road, Maharagama", "Tech", "Colombo", "Ambient", "09:00–11:00", 510.0, OrderStatus.CONFIRMED, True, False, None, None),
            ("ORD-1005", "Fresh Mart - Kiribathgoda", "Kandy Rd, Kiribathgoda", "Fresh", "Gampaha", "Chilled", "05:30–07:30", 450.0, OrderStatus.DEFERRED, False, False, None, "Previous capacity shortfall"),
            ("ORD-1006", "Style Hub - Kandy", "Dalada Veediya, Kandy", "Style", "Kandy", "Ambient", "10:00–13:00", 280.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1007", "Fresh Mart - Wattala", "Negombo Rd, Wattala", "Fresh", "Gampaha", "Chilled", "06:00–08:00", 360.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1008", "Waypoint Tech - Kandy City", "Kings St, Kandy", "Tech", "Kandy", "Ambient", "11:00–13:00", 410.0, OrderStatus.CONFIRMED, True, False, None, None),
            ("ORD-1009", "Style Hub - Negombo", "Main St, Negombo", "Style", "Gampaha", "Ambient", "13:00–15:00", 320.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1010", "Fresh Mart - Moratuwa", "Galle Rd, Moratuwa", "Fresh", "Colombo", "Chilled", "06:30–08:30", 490.0, OrderStatus.ALLOCATED, False, False, 1, None),
            ("ORD-1011", "Waypoint Tech - Galle Road", "Galle Rd, Colombo 04", "Tech", "Colombo", "Ambient", "14:00–16:00", 190.0, OrderStatus.ALLOCATED, False, False, 2, None),
            ("ORD-1012", "Fresh Mart - Dehiwala", "Station Rd, Dehiwala", "Fresh", "Colombo", "Chilled", "07:00–09:00", 390.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1013", "Fresh Mart - Panadura", "Arthur V Dias Mawatha, Panadura", "Fresh", "Colombo", "Chilled", "07:30–09:30", 310.0, OrderStatus.CONFIRMED, False, False, None, None),
            ("ORD-1014", "Style Hub - Colombo 03", "R. A. De Mel Mawatha, Colombo 03", "Style", "Colombo", "Ambient", "10:30–12:30", 260.0, OrderStatus.CONFIRMED, False, False, None, None),
            # Late orders queued for next operating day (cutoff 4:00 PM)
            ("ORD-1015", "Fresh Mart - Kelaniya", "Peliyagoda Rd, Kelaniya", "Fresh", "Gampaha", "Chilled", "05:30–07:30", 220.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
            ("ORD-1016", "Waypoint Tech - Battaramulla", "Pannipitiya Rd, Battaramulla", "Tech", "Colombo", "Ambient", "09:00–11:00", 180.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
            ("ORD-1017", "Style Hub - Rajagiriya", "Parliament Rd, Rajagiriya", "Style", "Colombo", "Ambient", "10:00–12:00", 310.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
            ("ORD-1018", "Fresh Mart - Malabe", "Athurugiriya Rd, Malabe", "Fresh", "Colombo", "Chilled", "06:00–08:00", 270.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
            ("ORD-1019", "Style Hub - Mount Lavinia", "Hotel Rd, Mount Lavinia", "Style", "Colombo", "Ambient", "11:00–13:00", 190.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
            ("ORD-1020", "Fresh Mart - Kottawa", "High Level Rd, Kottawa", "Fresh", "Colombo", "Chilled", "07:00–09:00", 340.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
            ("ORD-1021", "Waypoint Tech - Ja-Ela", "Negombo Rd, Ja-Ela", "Tech", "Gampaha", "Ambient", "13:00–15:00", 250.0, OrderStatus.CONFIRMED, False, True, None, "Order received after 4:00 PM cutoff"),
        ]

        for num, client, addr, brand, dist, temp, win, kg, stat, is_prio, is_late, alloc_idx, def_rsn in orders_raw:
            alloc_id = allocations[alloc_idx].id if alloc_idx is not None else None
            o = Order(
                order_number=num,
                client_name=client,
                destination_address=addr,
                brand=brand,
                district=dist,
                temperature_zone=temp,
                delivery_window=win,
                weight_kg=kg,
                status=stat,
                is_priority=is_prio,
                is_late=is_late,
                allocation_id=alloc_id,
                operating_date="2026-09-26",
                deferral_reason=def_rsn,
                total_amount=kg * 450.0,
            )
            db.add(o)
        db.commit()

        print("\n[OK] Seeding complete! All statuses covered:")
        print("  DRAFT        - VEH014 . RUN-029 . Kasun Perera   (94% load, needs review)")
        print("  ALLOCATED    - VEH022 . RUN-024 . Nimal Perera   (82% load, mark as ready)")
        print("  READY        - VEH031 . RUN-018 . Amal Fernando  (71% load, dispatch vehicle)")
        print("  LOADING      - VEH041 . RUN-011 . No driver       (58% load, being loaded)")
        print("  DISPATCHED   - VEH008 . RUN-005 . Ruwan Silva     (65% load, on road)")
        print("  COMPLETED    - VEH033 . RUN-001 . Kasun Perera   (78% load, done)")
        print("  UNAVAILABLE  - VEH019 . Under maintenance         (blocked)")
        print("  AVAILABLE    - VEH055 . Spare vehicle             (free, no allocation)")
        print("  ORDERS       - 14 Active orders (Confirmed, Priority, Deferred, Allocated) + 7 Late queued orders")

    except Exception as e:
        print(f"Error seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()

