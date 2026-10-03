"""Seed inventory items for Fresh, Style, and Tech chains."""
import os
import sys
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("DATABASE_URL")
if not url:
    print("No DATABASE_URL found")
    sys.exit(1)

from app.models.inventory import InventoryItem

engine = create_engine(url)
Session = sessionmaker(bind=engine)
db = Session()

SAMPLE_STOCKS = [
    # ── FRESH CHAIN ──
    {"sku": "FR-EGG-03", "name": "Omega-3 Enriched Eggs (10 pack)", "chain": "Fresh", "quantity": 480, "unit_price": 420.0, "unit_weight_kg": 0.65, "unit_volume_m3": 0.002, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-ICE-03", "name": "Vanilla Bean Gelato Tubs 2L", "chain": "Fresh", "quantity": 160, "unit_price": 1850.0, "unit_weight_kg": 1.4, "unit_volume_m3": 0.0035, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-CHK-01", "name": "Fresh Broiler Chicken (Whole)", "chain": "Fresh", "quantity": 320, "unit_price": 1250.0, "unit_weight_kg": 1.8, "unit_volume_m3": 0.004, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-BEEF-01", "name": "Prime Chilled Beef Cuts", "chain": "Fresh", "quantity": 85, "unit_price": 3400.0, "unit_weight_kg": 2.2, "unit_volume_m3": 0.0045, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-FSH-01", "name": "Fresh Sailfish Steaks", "chain": "Fresh", "quantity": 45, "unit_price": 2800.0, "unit_weight_kg": 1.5, "unit_volume_m3": 0.003, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-FRZ-01", "name": "Frozen Sweet Corn & Peas 1kg", "chain": "Fresh", "quantity": 290, "unit_price": 680.0, "unit_weight_kg": 1.05, "unit_volume_m3": 0.0022, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-MLK-01", "name": "Pasteurized Full Cream Milk 1L", "chain": "Fresh", "quantity": 650, "unit_price": 380.0, "unit_weight_kg": 1.03, "unit_volume_m3": 0.0015, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-YOG-02", "name": "Natural Set Curd Clay Pot 1kg", "chain": "Fresh", "quantity": 210, "unit_price": 490.0, "unit_weight_kg": 1.15, "unit_volume_m3": 0.0028, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},
    {"sku": "FR-VEG-04", "name": "Organic Salad Greens Mix 250g", "chain": "Fresh", "quantity": 120, "unit_price": 310.0, "unit_weight_kg": 0.3, "unit_volume_m3": 0.0018, "temp_requirement": "Chilled", "depot_name": "Peliyagoda Central"},

    # ── STYLE CHAIN ──
    {"sku": "ST-BLZR-02", "name": "Single-Breasted Casual Blazers", "chain": "Style", "quantity": 140, "unit_price": 8900.0, "unit_weight_kg": 1.1, "unit_volume_m3": 0.008, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-TSH-02", "name": "Organic Heavyweight Crew Neck Tees", "chain": "Style", "quantity": 920, "unit_price": 2200.0, "unit_weight_kg": 0.28, "unit_volume_m3": 0.0012, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-POLO-01", "name": "Pique Cotton Polo Shirts (Navy/White)", "chain": "Style", "quantity": 540, "unit_price": 3200.0, "unit_weight_kg": 0.35, "unit_volume_m3": 0.0015, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-SWTR-01", "name": "Merino Wool Knit Sweaters", "chain": "Style", "quantity": 95, "unit_price": 6400.0, "unit_weight_kg": 0.55, "unit_volume_m3": 0.003, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-SAND-02", "name": "Leather Beach Sandals", "chain": "Style", "quantity": 230, "unit_price": 4100.0, "unit_weight_kg": 0.75, "unit_volume_m3": 0.004, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-DNM-01", "name": "Slim-Fit Stretch Denim Jeans", "chain": "Style", "quantity": 380, "unit_price": 5800.0, "unit_weight_kg": 0.72, "unit_volume_m3": 0.0025, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-DRSS-03", "name": "Linen Wrap Floral Midi Dress", "chain": "Style", "quantity": 115, "unit_price": 7200.0, "unit_weight_kg": 0.45, "unit_volume_m3": 0.0022, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "ST-BELT-01", "name": "Full Grain Leather Casual Belts", "chain": "Style", "quantity": 310, "unit_price": 1950.0, "unit_weight_kg": 0.22, "unit_volume_m3": 0.0008, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},

    # ── TECH CHAIN ──
    {"sku": "TC-MON-02", "name": "27-inch IPS QHD Display Panels", "chain": "Tech", "quantity": 65, "unit_price": 74500.0, "unit_weight_kg": 6.8, "unit_volume_m3": 0.045, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-WEBC-01", "name": "Full HD 1080p Auto-Focus Webcams", "chain": "Tech", "quantity": 380, "unit_price": 9800.0, "unit_weight_kg": 0.25, "unit_volume_m3": 0.0015, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-UPS-01", "name": "Line Interactive UPS 1200VA", "chain": "Tech", "quantity": 110, "unit_price": 28900.0, "unit_weight_kg": 8.5, "unit_volume_m3": 0.022, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-BLN-02", "name": "High-Torque Glass Blenders", "chain": "Tech", "quantity": 175, "unit_price": 14200.0, "unit_weight_kg": 3.4, "unit_volume_m3": 0.018, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-ROUT-02", "name": "Gigabit 8-Port Desktop Switches", "chain": "Tech", "quantity": 290, "unit_price": 7600.0, "unit_weight_kg": 0.85, "unit_volume_m3": 0.003, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-HD-01", "name": "External Rugged Hard Drives 2TB", "chain": "Tech", "quantity": 240, "unit_price": 24500.0, "unit_weight_kg": 0.32, "unit_volume_m3": 0.0012, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-TONR-02", "name": "Genuine Black Ink Refill Packs", "chain": "Tech", "quantity": 420, "unit_price": 3800.0, "unit_weight_kg": 0.45, "unit_volume_m3": 0.0018, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
    {"sku": "TC-ROUT-01", "name": "Dual-Band Wi-Fi 6 Mesh Nodes", "chain": "Tech", "quantity": 88, "unit_price": 21500.0, "unit_weight_kg": 1.2, "unit_volume_m3": 0.005, "temp_requirement": "Ambient", "depot_name": "Peliyagoda Central"},
]

now = datetime.now(timezone.utc)
for s in SAMPLE_STOCKS:
    existing = db.query(InventoryItem).filter(InventoryItem.sku == s["sku"]).first()
    if existing:
        for k, v in s.items():
            setattr(existing, k, v)
        existing.updated_at = now
    else:
        item = InventoryItem(**s, updated_at=now)
        db.add(item)

db.commit()
print(f"Seeded {len(SAMPLE_STOCKS)} inventory items across Fresh, Style, and Tech chains.")
db.close()
