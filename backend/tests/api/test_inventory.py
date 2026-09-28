def test_inventory_and_warehouse(client):
    # 1. Create Warehouse
    wh_data = {
        "code": "WH-EAST-01",
        "name": "East Coast Distribution Hub",
        "location": "Newark, NJ",
        "capacity_sqft": 75000.0,
    }
    wh_res = client.post("/api/v1/inventory/warehouses", json=wh_data)
    assert wh_res.status_code == 201, wh_res.text
    warehouse = wh_res.json()
    assert warehouse["code"] == "WH-EAST-01"
    wh_id = warehouse["id"]

    # 2. Create Inventory Item
    item_data = {
        "sku": "SKU-BEARING-09",
        "name": "High-Load Ball Bearings (Set of 10)",
        "quantity": 150,
        "unit_price": 45.0,
        "warehouse_id": wh_id,
    }
    item_res = client.post("/api/v1/inventory/items", json=item_data)
    assert item_res.status_code == 201, item_res.text
    item = item_res.json()
    assert item["sku"] == "SKU-BEARING-09"
    assert item["quantity"] == 150

    # 3. List Warehouses & Items
    list_wh = client.get("/api/v1/inventory/warehouses")
    assert list_wh.status_code == 200
    assert any(w["code"] == "WH-EAST-01" for w in list_wh.json())

    list_items = client.get("/api/v1/inventory/items")
    assert list_items.status_code == 200
    assert any(i["sku"] == "SKU-BEARING-09" for i in list_items.json())
