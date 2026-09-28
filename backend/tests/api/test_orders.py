def test_order_lifecycle(client):
    # 1. Create Order
    order_data = {
        "order_number": "ORD-2026-001",
        "client_name": "Apex Manufacturing Ltd",
        "destination_address": "450 Industrial Parkway, Sector 9, Detroit, MI",
        "status": "draft",
        "items": [
            {
                "sku": "SKU-HYD-001",
                "item_name": "Hydraulic Pump Valve",
                "quantity": 5,
                "unit_price": 120.50,
            },
            {
                "sku": "SKU-SEAL-002",
                "item_name": "Rubber Pressure Gasket",
                "quantity": 20,
                "unit_price": 15.00,
            }
        ]
    }
    response = client.post("/api/v1/orders/", json=order_data)
    assert response.status_code == 201, response.text
    created_order = response.json()
    assert created_order["order_number"] == "ORD-2026-001"
    # Total calculation: (5 * 120.50) + (20 * 15.00) = 602.50 + 300.00 = 902.50
    assert created_order["total_amount"] == 902.50
    assert len(created_order["items"]) == 2
    order_id = created_order["id"]

    # 2. List Orders
    list_res = client.get("/api/v1/orders/")
    assert list_res.status_code == 200
    orders = list_res.json()
    assert any(o["order_number"] == "ORD-2026-001" for o in orders)

    # 3. Retrieve Order by ID
    get_res = client.get(f"/api/v1/orders/{order_id}")
    assert get_res.status_code == 200
    assert get_res.json()["client_name"] == "Apex Manufacturing Ltd"

    # 4. Patch Order Status
    patch_res = client.patch(f"/api/v1/orders/{order_id}", json={"status": "confirmed"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "confirmed"
