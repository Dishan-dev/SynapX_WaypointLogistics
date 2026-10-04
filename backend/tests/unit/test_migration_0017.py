"""Migration 0017_dock_arrival_pick on a throwaway SQLite copy of the tables it touches.

Runs the migration's upgrade() through alembic Operations on its own in-memory
engine: it never reads the app settings, so it cannot reach a real database.
The tables are the pre-0017 columns the migration reads or changes.
"""
import importlib.util
import logging
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION = Path(__file__).resolve().parents[2] / "alembic" / "versions" / "0017_dock_arrival_pick.py"

PRE_0017 = """
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE outlets (id INTEGER PRIMARY KEY);
CREATE TABLE dispatch_trips (id INTEGER PRIMARY KEY);
CREATE TABLE docks (id INTEGER PRIMARY KEY, code VARCHAR(20) NOT NULL, name VARCHAR(255) NOT NULL,
    depot VARCHAR(10) NOT NULL);
CREATE TABLE dock_tablets (id INTEGER PRIMARY KEY, label VARCHAR(100) NOT NULL,
    dock_id INTEGER NOT NULL REFERENCES docks(id));
CREATE TABLE loader_users (id INTEGER PRIMARY KEY, full_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50) NOT NULL, pin_hash VARCHAR(255) NOT NULL,
    home_dock_id INTEGER REFERENCES docks(id), is_active BOOLEAN NOT NULL, created_at DATETIME);
CREATE TABLE loader_sessions (id INTEGER PRIMARY KEY,
    loader_user_id INTEGER NOT NULL REFERENCES loader_users(id),
    dock_tablet_id INTEGER NOT NULL REFERENCES dock_tablets(id),
    started_at DATETIME NOT NULL, last_seen_at DATETIME NOT NULL, ended_at DATETIME, end_reason VARCHAR(20));
CREATE TABLE delivery_runs (id INTEGER PRIMARY KEY, code VARCHAR(20) NOT NULL,
    dock_id INTEGER NOT NULL REFERENCES docks(id), status VARCHAR(20) NOT NULL,
    departs_at DATETIME NOT NULL, released_at DATETIME, created_at DATETIME);
CREATE TABLE loader_activities (id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL REFERENCES delivery_runs(id),
    at DATETIME NOT NULL, event_type VARCHAR(40) NOT NULL, message TEXT NOT NULL);
CREATE TABLE notifications (id INTEGER PRIMARY KEY, outlet_id INTEGER NOT NULL REFERENCES outlets(id),
    order_id INTEGER, type VARCHAR(30) NOT NULL, category VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL,
    message TEXT, is_read BOOLEAN NOT NULL, created_at DATETIME NOT NULL);
"""


def load_migration():
    spec = importlib.util.spec_from_file_location("m0017", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def migrated(seed: str):
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        for statement in (PRE_0017 + seed).split(";"):
            if statement.strip():
                conn.exec_driver_sql(statement)
        with Operations.context(MigrationContext.configure(conn)):
            load_migration().upgrade()
    return engine


RUNS = """
INSERT INTO delivery_runs VALUES (1, 'RUN-001', 1, 'NOT_STARTED', '2026-10-05 03:30:00', NULL, '2026-10-04 20:00:00');
INSERT INTO delivery_runs VALUES (2, 'RUN-002', 1, 'LOADING', '2026-10-05 03:30:00', NULL, '2026-10-04 20:05:00');
INSERT INTO delivery_runs VALUES (3, 'RUN-003', 1, 'READY_TO_DEPART', '2026-10-05 04:00:00', '2026-10-04 21:00:00', NULL);
INSERT INTO delivery_runs VALUES (4, 'RUN-004', 1, 'GATED_OUT', '2026-10-04 03:30:00', '2026-10-03 21:00:00', '2026-10-03 19:00:00');
INSERT INTO delivery_runs VALUES (5, 'RUN-005', 1, 'ISSUE_FLAGGED', '2026-10-05 05:00:00', NULL, '2026-10-04 20:10:00');
"""


def test_runs_in_flight_stay_visible_and_no_past_release_notifies():
    engine = migrated("INSERT INTO docks VALUES (1, 'DOCK3', 'Dock 3', 'PELIYAGODA');" + RUNS)

    with engine.connect() as conn:
        rows = {r.code: r for r in conn.execute(sa.text(
            "SELECT code, arrived_at, arrived_dock_id, release_notified_at, released_at, "
            "picked_by_id, picked_session_id, picked_at FROM delivery_runs"
        ))}

    assert rows["RUN-001"].arrived_at is None  # not started: awaiting its truck, hidden
    assert rows["RUN-002"].arrived_at.startswith("2026-10-04 20:05")  # loading: arrived when built
    assert rows["RUN-002"].arrived_dock_id == 1
    assert rows["RUN-003"].arrived_at.startswith("2026-10-05 04:00")  # no created_at: departs_at
    assert rows["RUN-005"].arrived_at.startswith("2026-10-04 20:10")
    assert rows["RUN-004"].arrived_at is None  # gated out: gone
    assert rows["RUN-003"].release_notified_at == rows["RUN-003"].released_at
    assert rows["RUN-004"].release_notified_at == rows["RUN-004"].released_at
    assert rows["RUN-002"].release_notified_at is None
    assert all(r.picked_by_id is None and r.picked_session_id is None and r.picked_at is None for r in rows.values())


def test_the_driver_apps_at_dock_line_sets_the_arrival_from_its_earliest_entry():
    engine = migrated("INSERT INTO docks VALUES (1, 'DOCK3', 'Dock 3', 'PELIYAGODA');" + RUNS + """
        INSERT INTO loader_activities VALUES (1, 1, '2026-10-05 02:50:00', 'driver_at_dock', 'Driver at Dock 3 · A');
        INSERT INTO loader_activities VALUES (2, 1, '2026-10-05 02:40:00', 'driver_at_dock', 'Driver at Dock 3 · A');
        INSERT INTO loader_activities VALUES (3, 1, '2026-10-05 02:30:00', 'plan_published', 'Plan v1');
        INSERT INTO loader_activities VALUES (4, 2, '2026-10-04 20:30:00', 'driver_at_dock', 'Driver at Dock 3 · B');
    """)

    with engine.connect() as conn:
        rows = {r.code: r for r in conn.execute(sa.text(
            "SELECT code, arrived_at, arrived_dock_id FROM delivery_runs"
        ))}

    assert rows["RUN-001"].arrived_at.startswith("2026-10-05 02:40")  # not started, but the driver is there
    assert rows["RUN-001"].arrived_dock_id == 1
    assert rows["RUN-002"].arrived_at.startswith("2026-10-04 20:30")  # the driver's line beats created_at
    assert rows["RUN-005"].arrived_at.startswith("2026-10-04 20:10")  # no line: as before


def test_loader_depot_from_the_home_dock_else_the_only_depot_with_docks():
    engine = migrated("""
        INSERT INTO docks VALUES (1, 'DOCK3', 'Dock 3', 'PELIYAGODA');
        INSERT INTO docks VALUES (2, 'DOCK4', 'Dock 4', 'PELIYAGODA');
        INSERT INTO loader_users VALUES (1, 'Saman Jayawardena', 'Saman J.', 'x', 2, 1, NULL);
        INSERT INTO loader_users VALUES (2, 'Nimal Senanayake', 'Nimal S.', 'x', NULL, 1, NULL);
    """)

    with engine.connect() as conn:
        depots = dict(conn.execute(sa.text("SELECT short_name, depot FROM loader_users")).all())

    assert depots == {"Saman J.": "PELIYAGODA", "Nimal S.": "PELIYAGODA"}


def test_with_two_depots_a_loader_without_a_home_dock_is_left_and_logged(caplog):
    with caplog.at_level(logging.WARNING, logger="alembic.runtime.migration"):
        engine = migrated("""
            INSERT INTO docks VALUES (1, 'DOCK3', 'Dock 3', 'PELIYAGODA');
            INSERT INTO docks VALUES (2, 'KDOCK1', 'Kandy Dock 1', 'KANDY');
            INSERT INTO loader_users VALUES (1, 'Kasun Bandara', 'Kasun B.', 'x', 2, 1, NULL);
            INSERT INTO loader_users VALUES (2, 'Nimal Senanayake', 'Nimal S.', 'x', NULL, 1, NULL);
        """)

    with engine.connect() as conn:
        depots = dict(conn.execute(sa.text("SELECT short_name, depot FROM loader_users")).all())

    assert depots == {"Kasun B.": "KANDY", "Nimal S.": None}
    assert "#2 Nimal Senanayake" in caplog.text


def test_the_relaxed_columns_take_nulls_and_the_new_columns_exist():
    engine = migrated("""
        INSERT INTO docks VALUES (1, 'DOCK3', 'Dock 3', 'PELIYAGODA');
        INSERT INTO loader_users VALUES (1, 'Saman Jayawardena', 'Saman J.', 'x', 1, 1, NULL);
        INSERT INTO notifications VALUES (1, 1, NULL, 'DELIVERED', 'DELIVERY', 'Store one', NULL, 0, '2026-10-04');
    """)
    inspector = sa.inspect(engine)
    columns = {t: {c["name"]: c for c in inspector.get_columns(t)} for t in
               ("delivery_runs", "loader_users", "loader_sessions", "notifications")}

    assert columns["notifications"]["outlet_id"]["nullable"] is True
    assert columns["loader_sessions"]["dock_tablet_id"]["nullable"] is True
    assert {"arrived_at", "arrived_dock_id", "picked_by_id", "picked_session_id", "picked_at",
            "release_notified_at"} <= set(columns["delivery_runs"])
    assert "depot" in columns["loader_users"]
    assert {"recipient_user_id", "recipient_depot", "dispatch_trip_id"} <= set(columns["notifications"])
    with engine.begin() as conn:
        conn.execute(sa.text(
            "INSERT INTO notifications (id, outlet_id, recipient_depot, type, category, title, is_read, created_at) "
            "VALUES (2, NULL, 'PELIYAGODA', 'RUN_RELEASED', 'DELIVERY', 'RUN-1 released', 0, '2026-10-04')"
        ))
        conn.execute(sa.text(
            "INSERT INTO loader_sessions (id, loader_user_id, dock_tablet_id, started_at, last_seen_at) "
            "VALUES (1, 1, NULL, '2026-10-04', '2026-10-04')"
        ))
        store = conn.execute(sa.text("SELECT outlet_id, title FROM notifications WHERE id = 1")).one()
    assert tuple(store) == (1, "Store one")  # an existing row is unchanged


def test_downgrade_drops_what_upgrade_added():
    engine = migrated("INSERT INTO docks VALUES (1, 'DOCK3', 'Dock 3', 'PELIYAGODA');")
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            load_migration().downgrade()
    inspector = sa.inspect(engine)

    assert "arrived_at" not in {c["name"] for c in inspector.get_columns("delivery_runs")}
    assert "depot" not in {c["name"] for c in inspector.get_columns("loader_users")}
    assert "recipient_user_id" not in {c["name"] for c in inspector.get_columns("notifications")}


@pytest.mark.parametrize("label", ["RUN_RELEASED"])
def test_the_enum_value_is_the_member_name_like_the_others(label):
    from app.models.notification import NotificationType

    assert NotificationType[label].value == "run_released"
    assert "ADD VALUE IF NOT EXISTS 'RUN_RELEASED'" in MIGRATION.read_text(encoding="utf-8")
    assert "autocommit_block()" in MIGRATION.read_text(encoding="utf-8")
