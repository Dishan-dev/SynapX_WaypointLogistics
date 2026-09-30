import uuid
from datetime import datetime, timezone


def test_get_loading_tasks(client):
    response = client.get("/api/loading/tasks?vehicle_id=VEH001&date=2026-10-01")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["vehicle_id"] == "VEH001"
    assert "task_id" in data[0]
    assert data[0]["task_status"] == "pending"


def test_loading_task_lifecycle(client):
    # 1. Get tasks to obtain task_id
    res = client.get("/api/loading/tasks?vehicle_id=VEH001&date=2026-10-01")
    task_id = res.json()[0]["task_id"]

    # 2. Start loading
    loader_id = str(uuid.uuid4())
    start_res = client.patch(f"/api/loading/tasks/{task_id}/start", json={"loader_id": loader_id})
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "in_progress"

    # 3. Update loaded items
    item_res = client.patch(f"/api/loading/tasks/{task_id}/item", json={"loaded_units": 35})
    assert item_res.status_code == 200
    assert item_res.json()["loaded_units"] == 35

    # 4. Flag shortfall
    shortfall_res = client.patch(
        f"/api/loading/tasks/{task_id}/shortfall",
        json={"shortfall_notes": "5 units damaged in storage", "loaded_units": 35},
    )
    assert shortfall_res.status_code == 200
    assert shortfall_res.json()["status"] == "shortfall_flagged"
    assert shortfall_res.json()["shortfall_notes"] == "5 units damaged in storage"

    # 5. Complete loading
    comp_res = client.patch(f"/api/loading/tasks/{task_id}/complete")
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"


def test_delivery_receipt_flow(client):
    order_id = str(uuid.uuid4())
    outlet_id = "OUT001"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Submit receipt
    payload = {
        "order_id": order_id,
        "outlet_id": outlet_id,
        "units_received": 40,
        "weight_received_kg": 120.5,
        "has_issues": False,
        "confirmed_at": now_iso,
        "synced_from_offline": False,
    }
    submit_res = client.post("/api/receipts", json=payload)
    assert submit_res.status_code == 201
    receipt = submit_res.json()
    assert receipt["order_id"] == order_id
    assert receipt["has_issues"] is False

    # Duplicate should 409
    dup_res = client.post("/api/receipts", json=payload)
    assert dup_res.status_code == 409

    # Get receipt
    get_res = client.get(f"/api/receipts/{order_id}")
    assert get_res.status_code == 200
    assert get_res.json()["outlet_id"] == outlet_id


def test_offline_receipt_sync(client):
    order_1 = str(uuid.uuid4())
    order_2 = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    batch = {
        "receipts": [
            {
                "order_id": order_1,
                "outlet_id": "OUT001",
                "units_received": 30,
                "has_issues": False,
                "confirmed_at": now_iso,
                "synced_from_offline": True,
            },
            {
                "order_id": order_2,
                "outlet_id": "OUT002",
                "units_received": 20,
                "has_issues": True,
                "issue_type": "damaged",
                "issue_description": "2 units crushed in transit",
                "confirmed_at": now_iso,
                "synced_from_offline": True,
            },
        ]
    }
    sync_res = client.post("/api/receipts/sync", json=batch)
    assert sync_res.status_code == 200
    data = sync_res.json()
    assert data["synced"] == 2
    assert data["skipped"] == 0

    # Repeat sync should skip existing
    sync_res_2 = client.post("/api/receipts/sync", json=batch)
    assert sync_res_2.status_code == 200
    data_2 = sync_res_2.json()
    assert data_2["synced"] == 0
    assert data_2["skipped"] == 2
