import os
import sys
import random
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(__file__))
from app.models.order import Order, OrderItem, OrderStatus
from app.models.allocation import Allocation
from app.core.config import settings

url = settings.DATABASE_URL_UNPOOLED or settings.DATABASE_URL
engine = sa.create_engine(url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

SAMPLE_ORDERS = [
    # ── Colombo District: Chilled (Fresh Foods & Supermarkets) ───────────
    {
        "order_number": "ORD-1001",
        "client_name": "Fresh Mart - Nugegoda",
        "destination_address": "142 High Level Road, Nugegoda",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "05:30–07:30",
        "weight_kg": 420.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-CHK-01", "item_name": "Fresh Broiler Chicken (Whole)", "quantity": 120, "unit_price": 950.0},
            {"sku": "FR-MLK-02", "item_name": "Pasteurized Full Cream Milk 1L", "quantity": 180, "unit_price": 420.0},
            {"sku": "FR-YGT-03", "item_name": "Set Yoghurt Cups (80g x 12)", "quantity": 30, "unit_price": 960.0},
        ],
    },
    {
        "order_number": "ORD-1002",
        "client_name": "Keells Super - Kohuwala",
        "destination_address": "88 Dutugemunu St, Kohuwala",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "06:00–08:00",
        "weight_kg": 540.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": True,
        "is_late": False,
        "items": [
            {"sku": "FR-BEEF-01", "item_name": "Prime Chilled Beef Cuts", "quantity": 80, "unit_price": 2400.0},
            {"sku": "FR-BUT-02", "item_name": "Salted Table Butter 200g", "quantity": 200, "unit_price": 680.0},
            {"sku": "FR-ICE-03", "item_name": "Vanilla Bean Gelato Tubs 2L", "quantity": 60, "unit_price": 1850.0},
        ],
    },
    {
        "order_number": "ORD-1003",
        "client_name": "Fresh Mart - Dehiwala",
        "destination_address": "25 Station Road, Dehiwala",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "07:00–09:00",
        "weight_kg": 390.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-FSH-01", "item_name": "Fresh Sailfish Steaks", "quantity": 70, "unit_price": 1800.0},
            {"sku": "FR-EGG-02", "item_name": "Farm Fresh Brown Eggs (Tray of 30)", "quantity": 80, "unit_price": 990.0},
        ],
    },
    {
        "order_number": "ORD-1004",
        "client_name": "Cargills Food City - Colpetty",
        "destination_address": "452 Galle Road, Colombo 03",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "06:30–08:30",
        "weight_kg": 490.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": True,
        "is_late": False,
        "items": [
            {"sku": "FR-VEG-01", "item_name": "Hydroponic Salad Greens Box", "quantity": 90, "unit_price": 750.0},
            {"sku": "FR-CHS-02", "item_name": "Processed Cheddar Block 1kg", "quantity": 50, "unit_price": 3200.0},
        ],
    },
    {
        "order_number": "ORD-1005",
        "client_name": "Arpico Supercentre - Hyde Park Corner",
        "destination_address": "12 Hyde Park Corner, Colombo 02",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "05:00–07:00",
        "weight_kg": 680.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-PRW-01", "item_name": "Cleaned Tiger Prawns 500g", "quantity": 100, "unit_price": 2100.0},
            {"sku": "FR-SMK-02", "item_name": "Smoked Chicken Sausages 1kg", "quantity": 150, "unit_price": 1650.0},
        ],
    },

    # ── Colombo District: Ambient (Fashion, Apparel & Style) ───────────────
    {
        "order_number": "ORD-1006",
        "client_name": "Style Hub - One Galle Face Mall",
        "destination_address": "Level 2, OGF Mall, Colombo 01",
        "brand": "Style",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "10:00–12:00",
        "weight_kg": 240.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "ST-POLO-01", "item_name": "Pique Cotton Polo Shirts (Navy/White)", "quantity": 250, "unit_price": 3800.0},
            {"sku": "ST-CHIN-02", "item_name": "Slim Fit Stretch Chinos", "quantity": 140, "unit_price": 5400.0},
        ],
    },
    {
        "order_number": "ORD-1007",
        "client_name": "Style Hub - Colombo 03",
        "destination_address": "184 R. A. De Mel Mawatha, Colombo 03",
        "brand": "Style",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "10:30–12:30",
        "weight_kg": 260.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "ST-DRSS-01", "item_name": "Linen Wrap Floral Midi Dress", "quantity": 80, "unit_price": 6900.0},
            {"sku": "ST-BLZR-02", "item_name": "Single-Breasted Casual Blazers", "quantity": 40, "unit_price": 12500.0},
        ],
    },
    {
        "order_number": "ORD-1008",
        "client_name": "Odel Department Store - Alexandra Place",
        "destination_address": "5 Alexandra Place, Colombo 07",
        "brand": "Style",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "11:00–13:00",
        "weight_kg": 380.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": True,
        "is_late": False,
        "items": [
            {"sku": "ST-DNM-01", "item_name": "Raw Indigo Denim Jeans", "quantity": 160, "unit_price": 6200.0},
            {"sku": "ST-TSH-02", "item_name": "Organic Heavyweight Crew Neck Tees", "quantity": 300, "unit_price": 2800.0},
        ],
    },

    # ── Colombo District: Ambient (Tech & Electronics) ───────────────────
    {
        "order_number": "ORD-1009",
        "client_name": "Waypoint Tech - Maharagama",
        "destination_address": "52 High Level Road, Maharagama",
        "brand": "Tech",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "09:00–11:00",
        "weight_kg": 510.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": True,
        "is_late": False,
        "items": [
            {"sku": "TC-UPS-01", "item_name": "Line Interactive UPS 1200VA", "quantity": 25, "unit_price": 24500.0},
            {"sku": "TC-MON-02", "item_name": "27-inch IPS QHD Display Panels", "quantity": 30, "unit_price": 48000.0},
            {"sku": "TC-CBL-03", "item_name": "Cat6 UTP Cable Spools 305m", "quantity": 15, "unit_price": 18500.0},
        ],
    },
    {
        "order_number": "ORD-1010",
        "client_name": "Waypoint Tech - Galle Road",
        "destination_address": "310 Galle Road, Colombo 04",
        "brand": "Tech",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "14:00–16:00",
        "weight_kg": 190.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "TC-ROUT-01", "item_name": "Dual-Band Wi-Fi 6 Mesh Nodes", "quantity": 40, "unit_price": 16800.0},
            {"sku": "TC-KB-02", "item_name": "Mechanical RGB Gaming Keyboards", "quantity": 55, "unit_price": 11500.0},
        ],
    },
    {
        "order_number": "ORD-1011",
        "client_name": "Singer Mega - Nugegoda",
        "destination_address": "18 Stanley Thilakarathne Mawatha, Nugegoda",
        "brand": "Tech",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "13:30–15:30",
        "weight_kg": 620.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "TC-MIC-01", "item_name": "Convection Microwave Ovens 28L", "quantity": 18, "unit_price": 38000.0},
            {"sku": "TC-BLN-02", "item_name": "High-Torque Glass Blenders", "quantity": 45, "unit_price": 8900.0},
        ],
    },

    # ── Gampaha District: Chilled & Ambient ───────────────────────────────
    {
        "order_number": "ORD-1012",
        "client_name": "Fresh Mart - Wattala",
        "destination_address": "210 Negombo Road, Wattala",
        "brand": "Fresh",
        "district": "Gampaha",
        "temperature_zone": "Chilled",
        "delivery_window": "06:00–08:00",
        "weight_kg": 360.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-CHK-02", "item_name": "Skinless Chicken Breast Fillets", "quantity": 110, "unit_price": 1450.0},
            {"sku": "FR-CURD-01", "item_name": "Buffalo Curd Clay Pots 1L", "quantity": 80, "unit_price": 650.0},
        ],
    },
    {
        "order_number": "ORD-1013",
        "client_name": "Fresh Mart - Kiribathgoda",
        "destination_address": "15 Kandy Road, Kiribathgoda",
        "brand": "Fresh",
        "district": "Gampaha",
        "temperature_zone": "Chilled",
        "delivery_window": "05:30–07:30",
        "weight_kg": 450.0,
        "status": OrderStatus.DEFERRED,
        "is_priority": False,
        "is_late": False,
        "deferral_reason": "Loading dock congestion at destination",
        "items": [
            {"sku": "FR-FRZ-01", "item_name": "Frozen Sweet Corn & Peas 1kg", "quantity": 160, "unit_price": 820.0},
            {"sku": "FR-SGS-03", "item_name": "Bockwurst Cocktail Sausages", "quantity": 100, "unit_price": 1100.0},
        ],
    },
    {
        "order_number": "ORD-1014",
        "client_name": "Style Hub - Negombo",
        "destination_address": "76 Main Street, Negombo",
        "brand": "Style",
        "district": "Gampaha",
        "temperature_zone": "Ambient",
        "delivery_window": "13:00–15:00",
        "weight_kg": 320.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "ST-SWIM-01", "item_name": "Quick-Dry Boardshorts", "quantity": 140, "unit_price": 3200.0},
            {"sku": "ST-SAND-02", "item_name": "Leather Beach Sandals", "quantity": 90, "unit_price": 4500.0},
        ],
    },
    {
        "order_number": "ORD-1015",
        "client_name": "Waypoint Tech - Kadawatha",
        "destination_address": "33 Kandy Road, Kadawatha",
        "brand": "Tech",
        "district": "Gampaha",
        "temperature_zone": "Ambient",
        "delivery_window": "09:30–11:30",
        "weight_kg": 270.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "TC-ROUT-02", "item_name": "Gigabit 8-Port Desktop Switches", "quantity": 35, "unit_price": 8200.0},
            {"sku": "TC-WEBC-01", "item_name": "Full HD 1080p Auto-Focus Webcams", "quantity": 60, "unit_price": 7500.0},
        ],
    },

    # ── Kandy District: Chilled & Ambient ─────────────────────────────────
    {
        "order_number": "ORD-1016",
        "client_name": "Fresh Mart - Kandy City",
        "destination_address": "12 Dalada Veediya, Kandy",
        "brand": "Fresh",
        "district": "Kandy",
        "temperature_zone": "Chilled",
        "delivery_window": "06:00–08:00",
        "weight_kg": 380.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-CHK-03", "item_name": "Marinated Barbecue Chicken Wings", "quantity": 90, "unit_price": 1350.0},
            {"sku": "FR-MLK-03", "item_name": "Low Fat Fresh Milk Cartons", "quantity": 140, "unit_price": 440.0},
        ],
    },
    {
        "order_number": "ORD-1017",
        "client_name": "Style Hub - Kandy",
        "destination_address": "45 William Gopallawa Mawatha, Kandy",
        "brand": "Style",
        "district": "Kandy",
        "temperature_zone": "Ambient",
        "delivery_window": "10:00–13:00",
        "weight_kg": 280.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "ST-SWTR-01", "item_name": "Merino Wool Knit Sweaters", "quantity": 80, "unit_price": 7800.0},
            {"sku": "ST-JKT-02", "item_name": "Waterproof Windbreaker Jackets", "quantity": 60, "unit_price": 8900.0},
        ],
    },
    {
        "order_number": "ORD-1018",
        "client_name": "Waypoint Tech - Kandy City Centre",
        "destination_address": "KCC Level 3, Dalada Veediya, Kandy",
        "brand": "Tech",
        "district": "Kandy",
        "temperature_zone": "Ambient",
        "delivery_window": "11:00–13:00",
        "weight_kg": 410.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": True,
        "is_late": False,
        "items": [
            {"sku": "TC-PRNT-01", "item_name": "Wireless EcoTank Color Printers", "quantity": 14, "unit_price": 64000.0},
            {"sku": "TC-TONR-02", "item_name": "Genuine Black Ink Refill Packs", "quantity": 120, "unit_price": 2800.0},
        ],
    },
    {
        "order_number": "ORD-1019",
        "client_name": "Keells Super - Peradeniya",
        "destination_address": "840 Peradeniya Road, Kandy",
        "brand": "Fresh",
        "district": "Kandy",
        "temperature_zone": "Chilled",
        "delivery_window": "06:30–08:30",
        "weight_kg": 520.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-YGT-04", "item_name": "Greek Style Drinking Yoghurt 200ml", "quantity": 250, "unit_price": 280.0},
            {"sku": "FR-CHS-03", "item_name": "Mozzarella Shredded Cheese 1kg", "quantity": 40, "unit_price": 3800.0},
        ],
    },

    # ── Already Allocated Orders (Linked to Active Runs) ─────────────────
    {
        "order_number": "ORD-1020",
        "client_name": "Fresh Mart - Moratuwa",
        "destination_address": "285 Galle Road, Moratuwa",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "06:30–08:30",
        "weight_kg": 490.0,
        "status": OrderStatus.ALLOCATED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-CHK-01", "item_name": "Fresh Broiler Chicken (Whole)", "quantity": 150, "unit_price": 950.0},
        ],
    },
    {
        "order_number": "ORD-1021",
        "client_name": "Arpico Daily - Panadura",
        "destination_address": "58 Arthur V Dias Mawatha, Panadura",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "07:30–09:30",
        "weight_kg": 310.0,
        "status": OrderStatus.ALLOCATED,
        "is_priority": False,
        "is_late": False,
        "items": [
            {"sku": "FR-BUT-01", "item_name": "Unsalted Cooking Butter 500g", "quantity": 70, "unit_price": 1400.0},
        ],
    },

    # ── Queued Late Orders (Past 4:00 PM cutoff window) ───────────────────
    {
        "order_number": "ORD-1022",
        "client_name": "Fresh Mart - Kelaniya",
        "destination_address": "90 Peliyagoda Road, Kelaniya",
        "brand": "Fresh",
        "district": "Gampaha",
        "temperature_zone": "Chilled",
        "delivery_window": "05:30–07:30",
        "weight_kg": 220.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "FR-MILK-04", "item_name": "Fresh Strawberry Flavored Milk", "quantity": 180, "unit_price": 320.0},
        ],
    },
    {
        "order_number": "ORD-1023",
        "client_name": "Waypoint Tech - Battaramulla",
        "destination_address": "104 Pannipitiya Road, Battaramulla",
        "brand": "Tech",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "09:00–11:00",
        "weight_kg": 180.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "TC-HD-01", "item_name": "External Rugged Hard Drives 2TB", "quantity": 25, "unit_price": 28500.0},
        ],
    },
    {
        "order_number": "ORD-1024",
        "client_name": "Style Hub - Rajagiriya",
        "destination_address": "512 Sri Jayawardenepura Mawatha, Rajagiriya",
        "brand": "Style",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "10:00–12:00",
        "weight_kg": 310.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "ST-DENIM-03", "item_name": "High-Waist Washed Denim Jeans", "quantity": 90, "unit_price": 5800.0},
        ],
    },
    {
        "order_number": "ORD-1025",
        "client_name": "Fresh Mart - Malabe",
        "destination_address": "18 Athurugiriya Road, Malabe",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "06:00–08:00",
        "weight_kg": 270.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "FR-FSH-02", "item_name": "Reef Cod Slices 500g", "quantity": 80, "unit_price": 1400.0},
        ],
    },
    {
        "order_number": "ORD-1026",
        "client_name": "Style Hub - Mount Lavinia",
        "destination_address": "33 Hotel Road, Mount Lavinia",
        "brand": "Style",
        "district": "Colombo",
        "temperature_zone": "Ambient",
        "delivery_window": "11:00–13:00",
        "weight_kg": 190.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "ST-TEE-04", "item_name": "Vintage Print Beach Tees", "quantity": 110, "unit_price": 2400.0},
        ],
    },
    {
        "order_number": "ORD-1027",
        "client_name": "Fresh Mart - Kottawa",
        "destination_address": "220 High Level Road, Kottawa",
        "brand": "Fresh",
        "district": "Colombo",
        "temperature_zone": "Chilled",
        "delivery_window": "07:00–09:00",
        "weight_kg": 340.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "FR-EGG-03", "item_name": "Omega-3 Enriched Eggs (10 pack)", "quantity": 150, "unit_price": 480.0},
        ],
    },
    {
        "order_number": "ORD-1028",
        "client_name": "Waypoint Tech - Ja-Ela",
        "destination_address": "64 Negombo Road, Ja-Ela",
        "brand": "Tech",
        "district": "Gampaha",
        "temperature_zone": "Ambient",
        "delivery_window": "13:00–15:00",
        "weight_kg": 250.0,
        "status": OrderStatus.CONFIRMED,
        "is_priority": False,
        "is_late": True,
        "deferral_reason": "Order submitted after 4:00 PM cutoff window",
        "items": [
            {"sku": "TC-CAB-05", "item_name": "Braided HDMI 2.1 4K Cables", "quantity": 120, "unit_price": 1800.0},
        ],
    },
]


def seed_orders():
    db = SessionLocal()
    try:
        print("Cleaning existing orders and order items...")
        db.execute(sa.text("DELETE FROM order_items"))
        db.execute(sa.text("DELETE FROM orders"))
        db.commit()

        # Find existing active allocations to link allocated orders
        allocations = db.query(Allocation).all()
        alloc_map = {idx: a.id for idx, a in enumerate(allocations)}

        print(f"Seeding {len(SAMPLE_ORDERS)} realistic retail & distribution orders...")
        total_items = 0

        for idx, spec in enumerate(SAMPLE_ORDERS):
            items_data = spec.get("items", [])
            total_amt = sum(item["quantity"] * item["unit_price"] for item in items_data)

            # Assign allocation id for allocated orders if allocations exist
            alloc_id = None
            if spec["status"] == OrderStatus.ALLOCATED and alloc_map:
                alloc_id = alloc_map.get(idx % len(alloc_map))

            order = Order(
                order_number=spec["order_number"],
                client_name=spec["client_name"],
                destination_address=spec["destination_address"],
                brand=spec["brand"],
                district=spec["district"],
                temperature_zone=spec["temperature_zone"],
                delivery_window=spec["delivery_window"],
                weight_kg=spec["weight_kg"],
                status=spec["status"],
                is_priority=spec["is_priority"],
                is_late=spec["is_late"],
                operating_date="2026-09-26",
                deferral_reason=spec.get("deferral_reason"),
                allocation_id=alloc_id,
                total_amount=total_amt,
            )
            db.add(order)
            db.flush()

            for item in items_data:
                db_item = OrderItem(
                    order_id=order.id,
                    sku=item["sku"],
                    item_name=item["item_name"],
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                )
                db.add(db_item)
                total_items += 1

        db.commit()
        print(f"[OK] Successfully seeded {len(SAMPLE_ORDERS)} orders and {total_items} order items!")
        print("     Confirmed unallocated queue:", len([o for o in SAMPLE_ORDERS if o['status'] == OrderStatus.CONFIRMED and not o['is_late']]))
        print("     Priority rush orders:", len([o for o in SAMPLE_ORDERS if o['is_priority']]))
        print("     Deferred orders:", len([o for o in SAMPLE_ORDERS if o['status'] == OrderStatus.DEFERRED]))
        print("     Allocated orders:", len([o for o in SAMPLE_ORDERS if o['status'] == OrderStatus.ALLOCATED]))
        print("     Queued Late orders (next day):", len([o for o in SAMPLE_ORDERS if o['is_late']]))

    except Exception as e:
        print(f"Error seeding orders: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_orders()
