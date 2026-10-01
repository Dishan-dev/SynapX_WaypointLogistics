import pytest
from fastapi.testclient import TestClient


def test_list_and_create_issue(client: TestClient):
    # 1. Fetch initial seed issues
    res = client.get("/api/v1/issues")
    assert res.status_code == 200
    issues = res.json()
    assert len(issues) >= 3

    # 2. Create new delivery issue
    new_issue_payload = {
        "order_number": "ORD0000010",
        "outlet_id": 5,
        "issue_type": "Damaged Goods",
        "title": "Crushed boxes of tomatoes",
        "affected_item": "Fresh Tomatoes 5kg",
        "sku": "SKU-990",
        "expected_units": 10,
        "received_units": 7,
        "description": "3 boxes crushed during handling.",
        "reported_by": "Sarah Jenkins (Store Manager)",
        "driver_name": "Kamal Perera",
        "vehicle_id": "VEH001",
    }
    create_res = client.post("/api/v1/issues", json=new_issue_payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["id"] is not None
    assert created["title"] == "Crushed boxes of tomatoes"
    assert created["status"] == "open"

    # 3. Update status to resolved
    patch_res = client.patch(
        f"/api/v1/issues/{created['id']}",
        json={"status": "resolved", "resolution_notes": "Credit note issued"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "resolved"
    assert updated["resolution_notes"] == "Credit note issued"
