import csv
from pathlib import Path


ROOT = Path("data")
STAMP = "2026-10-03T12:00:00"
TARGET_NEW_ROWS = 334


def cycle_item(items, index):
    return items[index % len(items)]


def fresh_row(index):
    products = [
        ("FML", "Full Cream Milk", 1.03, 0.0015),
        ("YGT", "Greek Yogurt", 0.52, 0.0012),
        ("CHS", "Mature Cheddar Cheese", 0.42, 0.0010),
        ("SFM", "Salmon Fillets", 0.35, 0.0015),
        ("CHK", "Chicken Breast Fillets", 0.60, 0.0020),
        ("FRZ", "Frozen Mixed Vegetables", 1.00, 0.0025),
        ("ICE", "Premium Ice Cream", 0.75, 0.0020),
        ("BTR", "Salted Butter", 0.52, 0.0011),
        ("JUI", "Fresh Fruit Juice", 1.08, 0.0017),
        ("FRU", "Seasonal Fruit Selection", 0.65, 0.0027),
    ]
    sizes = ["250g", "500g", "750g", "1kg", "2kg", "1L", "2L", "Family Pack", "Value Pack", "Chef Pack"]
    flavors = ["Classic", "Natural", "Mild", "Herb", "Coconut", "Mango", "Vanilla", "Strawberry", "Pepper", "Original"]
    code, product, weight, volume = cycle_item(products, index)
    size = cycle_item(sizes, index // len(products))
    flavor = cycle_item(flavors, index // (len(products) * len(sizes)))
    multiplier = 0.75 + ((index % 5) * 0.25)
    return {
        "sku": f"FR-{code}-{index + 100:03d}",
        "name": f"{flavor} {product} {size}",
        "chain": "Fresh",
        "unit_weight_kg": round(weight * multiplier, 2),
        "unit_volume_m3": round(volume * multiplier, 4),
        "temp_requirement": "Chilled",
        "depot_name": "Peliyagoda Central",
        "last_updated": STAMP,
    }


def style_row(index):
    products = [
        ("TEE", "Cotton Crew Neck T-Shirt", 0.28, 0.0012),
        ("SHR", "Oxford Button-Down Shirt", 0.35, 0.0018),
        ("JNS", "Straight Fit Denim Jeans", 0.72, 0.0025),
        ("DRS", "Printed Midi Dress", 0.45, 0.0023),
        ("JKT", "Lightweight Bomber Jacket", 0.76, 0.0060),
        ("SNE", "Everyday Canvas Sneakers", 0.88, 0.0052),
        ("BAG", "Structured Tote Bag", 0.64, 0.0060),
        ("KNT", "Fine Knit Cardigan", 0.48, 0.0028),
        ("SKT", "Pleated A-Line Skirt", 0.40, 0.0024),
        ("ACC", "Woven Fashion Scarf", 0.18, 0.0010),
    ]
    colors = ["Navy", "Black", "White", "Olive", "Sand", "Burgundy", "Sky Blue", "Charcoal", "Coral", "Stone"]
    sizes = ["XS", "S", "M", "L", "XL", "2XL", "Petite", "Regular", "Tall", "One Size"]
    collections = ["Core", "Weekend", "Urban", "Resort"]
    code, product, weight, volume = cycle_item(products, index)
    color = cycle_item(colors, index // len(products))
    size = cycle_item(sizes, index // (len(products) * len(colors)))
    collection = cycle_item(collections, index // (len(products) * len(colors) * len(sizes)))
    return {
        "sku": f"ST-{code}-{index + 100:03d}",
        "name": f"{collection} {color} {product} {size}",
        "chain": "Style",
        "unit_weight_kg": weight,
        "unit_volume_m3": volume,
        "temp_requirement": "Ambient",
        "depot_name": "Peliyagoda Central",
        "last_updated": STAMP,
    }


def tech_row(index):
    products = [
        ("TAB", "Android Tablet", 0.62, 0.0042),
        ("MON", "QHD Computer Monitor", 6.80, 0.0450),
        ("PRN", "Compact Laser Printer", 12.80, 0.0610),
        ("AUD", "Wireless Headphones", 0.42, 0.0038),
        ("CAM", "Mirrorless Camera Kit", 1.15, 0.0090),
        ("ROU", "Wi-Fi Mesh Router", 1.20, 0.0050),
        ("DRV", "Portable Solid-State Drive", 0.20, 0.0010),
        ("AIR", "Smart Air Purifier", 5.60, 0.0320),
        ("UPS", "Line Interactive UPS", 8.50, 0.0220),
        ("SPK", "Portable Bluetooth Speaker", 0.90, 0.0055),
    ]
    variants = ["Standard", "Plus", "Pro", "Lite", "Max", "Essential", "Smart", "Business", "Home", "Travel"]
    capacities = ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4K", "1080p", "1200VA", "2400VA"]
    generations = ["Gen 1", "Gen 2", "Gen 3", "Series A"]
    code, product, weight, volume = cycle_item(products, index)
    variant = cycle_item(variants, index // len(products))
    capacity = cycle_item(capacities, index // (len(products) * len(variants)))
    generation = cycle_item(generations, index // (len(products) * len(variants) * len(capacities)))
    return {
        "sku": f"TC-{code}-{index + 100:03d}",
        "name": f"{variant} {product} {capacity} {generation}",
        "chain": "Tech",
        "unit_weight_kg": weight,
        "unit_volume_m3": volume,
        "temp_requirement": "Ambient",
        "depot_name": "Peliyagoda Central",
        "last_updated": STAMP,
    }


def extend(filename, row_factory):
    path = ROOT / filename
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
        fields = list(rows[0])
    new_rows = [row_factory(index) for index in range(TARGET_NEW_ROWS)]
    all_rows = rows + new_rows
    skus = [row["sku"] for row in all_rows]
    if len(skus) != len(set(skus)):
        raise ValueError(f"Duplicate SKU in {filename}")
    with path.open("w", newline="", encoding="utf-8") as destination:
        writer = csv.DictWriter(destination, fieldnames=fields)
        writer.writeheader()
        writer.writerows(all_rows)


extend("fresh_cargo_specs.csv", fresh_row)
extend("style_cargo_specs.csv", style_row)
extend("tech_cargo_specs.csv", tech_row)
