from app.models.loader_user import LoaderUser
from app.models.reference import Depot, Dock
from app.core.security import get_password_hash


def test_admin_assigns_multiple_loaders_to_depot(client, db_session):
    # Ensure docks exist
    p_dock = db_session.query(Dock).filter(Dock.depot == Depot.PELIYAGODA).first()
    if not p_dock:
        p_dock = Dock(code="DCK-P99", name="Peliyagoda Bay 99", depot=Depot.PELIYAGODA)
        db_session.add(p_dock)

    k_dock = db_session.query(Dock).filter(Dock.depot == Depot.KANDY).first()
    if not k_dock:
        k_dock = Dock(code="DCK-K99", name="Kandy Bay 99", depot=Depot.KANDY)
        db_session.add(k_dock)
    db_session.commit()

    # Create test loaders
    loader1 = LoaderUser(
        full_name="Test Loader One",
        short_name="Loader 1",
        pin_hash=get_password_hash("1234"),
        home_dock_id=None,
        is_active=True,
    )
    loader2 = LoaderUser(
        full_name="Test Loader Two",
        short_name="Loader 2",
        pin_hash=get_password_hash("1234"),
        home_dock_id=None,
        is_active=True,
    )
    db_session.add_all([loader1, loader2])
    db_session.commit()

    # 1. Assign loader1 to Peliyagoda
    res1 = client.post(
        "/api/v1/admin/depots/peliyagoda/loaders",
        json={"loader_id": loader1.id},
    )
    assert res1.status_code == 200, res1.text
    data1 = res1.json()
    assert data1["status"] == "success"
    assert data1["depot"] == "peliyagoda"

    # 2. Assign loader2 also to Peliyagoda (Multiple loaders in single depot)
    res2 = client.post(
        "/api/v1/admin/depots/peliyagoda/loaders",
        json={"loader_id": loader2.id},
    )
    assert res2.status_code == 200, res2.text
    data2 = res2.json()
    assert data2["status"] == "success"
    loader_ids = [l["id"] for l in data2["loaders"]]
    assert loader1.id in loader_ids
    assert loader2.id in loader_ids

    # 3. Check GET /api/v1/admin/depots includes loaders for Peliyagoda
    depots = client.get("/api/v1/admin/depots").json()
    p_depot_loaders = [l["id"] for l in depots["peliyagoda"]["loaders"]]
    assert loader1.id in p_depot_loaders
    assert loader2.id in p_depot_loaders

    # 4. Transfer loader2 from Peliyagoda to Kandy
    transfer_res = client.post(
        "/api/v1/admin/depots/kandy/loaders",
        json={"loader_id": loader2.id},
    )
    assert transfer_res.status_code == 200
    k_loaders = [l["id"] for l in transfer_res.json()["loaders"]]
    assert loader2.id in k_loaders

    # 5. Unassign loader1 from Peliyagoda
    unassign_res = client.delete(f"/api/v1/admin/depots/peliyagoda/loaders/{loader1.id}")
    assert unassign_res.status_code == 200
    p_loaders_after = [l["id"] for l in unassign_res.json()["loaders"]]
    assert loader1.id not in p_loaders_after
