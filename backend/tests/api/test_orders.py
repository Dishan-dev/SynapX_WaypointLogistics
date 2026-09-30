def test_orders_metrics_and_filters(client):
    # 1. Create test orders
    orders_to_create = [
        {
            "order_number": "ORD-TEST-001",
            "client_name": "Fresh Mart - Nugegoda",
            "destination_address": "High Level Rd, Nugegoda",
            "brand": "Fresh",
            "district": "Colombo",
            "temperature_zone": "Chilled",
            "delivery_window": "05:30–07:30",
            "weight_kg": 420.0,
            "status": "CONFIRMED",
            "is_priority": False,
            "is_late": False,
        },
        {
            "order_number": "ORD-TEST-002",
            "client_name": "Style Hub - Kandy",
            "destination_address": "Dalada Veediya, Kandy",
            "brand": "Style",
            "district": "Kandy",
            "temperature_zone": "Ambient",
            "delivery_window": "10:00–13:00",
            "weight_kg": 280.0,
            "status": "CONFIRMED",
            "is_priority": True,
            "is_late": False,
        },
        {
            "order_number": "ORD-TEST-003",
            "client_name": "Waypoint Tech - Maharagama",
            "destination_address": "Old Rd, Maharagama",
            "brand": "Tech",
            "district": "Colombo",
            "temperature_zone": "Ambient",
            "delivery_window": "09:00–11:00",
            "weight_kg": 300.0,
            "status": "DEFERRED",
            "is_priority": False,
            "is_late": False,
        },
        {
            "order_number": "ORD-TEST-004",
            "client_name": "Fresh Mart - Kelaniya",
            "destination_address": "Peliyagoda Rd, Kelaniya",
            "brand": "Fresh",
            "district": "Gampaha",
            "temperature_zone": "Chilled",
            "delivery_window": "05:30–07:30",
            "weight_kg": 220.0,
            "status": "CONFIRMED",
            "is_priority": False,
            "is_late": True,
        },
    ]

    created_ids = []
    for payload in orders_to_create:
        res = client.post("/api/v1/orders/", json=payload)
        assert res.status_code == 201, res.text
        created_ids.append(res.json()["id"])

    # 2. Fetch metrics
    metrics_res = client.get("/api/v1/orders/metrics")
    assert metrics_res.status_code == 200, metrics_res.text
    metrics = metrics_res.json()
    assert metrics["total_orders"] == 4
    assert metrics["confirmed"] == 3
    assert metrics["unallocated"] == 2
    assert metrics["deferred"] == 1
    assert metrics["priority"] == 1
    assert metrics["late"] == 1

    # 3. Filter by brand
    fresh_res = client.get("/api/v1/orders/?brand=Fresh")
    assert fresh_res.status_code == 200
    fresh_orders = fresh_res.json()
    assert len(fresh_orders) == 2

    # 4. Filter by district
    kandy_res = client.get("/api/v1/orders/?district=Kandy")
    assert kandy_res.status_code == 200
    kandy_orders = kandy_res.json()
    assert len(kandy_orders) == 1
    assert kandy_orders[0]["order_number"] == "ORD-TEST-002"

    # 5. Filter late orders
    late_res = client.get("/api/v1/orders/?is_late=true")
    assert late_res.status_code == 200
    late_orders = late_res.json()
    assert len(late_orders) == 1
    assert late_orders[0]["order_number"] == "ORD-TEST-004"

    # 6. Bulk allocate orders
    bulk_res = client.post("/api/v1/orders/bulk-allocate", json={"order_ids": [created_ids[0]]})
    assert bulk_res.status_code == 200
    assert bulk_res.json()["count"] == 1

    # Verify status changed to ALLOCATED
    order1 = client.get(f"/api/v1/orders/{created_ids[0]}").json()
    assert order1["status"] == "ALLOCATED"

    # 7. Defer an order
    defer_res = client.post(f"/api/v1/orders/{created_ids[1]}/defer", json={"reason": "Capacity limit reached"})
    assert defer_res.status_code == 200
    assert defer_res.json()["status"] == "DEFERRED"
    assert defer_res.json()["deferral_reason"] == "Capacity limit reached"
