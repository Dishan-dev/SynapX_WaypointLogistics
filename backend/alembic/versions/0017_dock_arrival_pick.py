"""Dock arrival, the pick lock, depot loaders and release notifications.

Revision ID: 0017_dock_arrival_pick
Revises: 0016_sos_photo

The loader run is still built when the dispatcher dispatches the trip, but stays hidden from the loader queue
until the driver taps "Arrived at dock". Loaders now belong to a depot and see every dock of it; one loader
picks a run and holds it while their session is live. When a release can no longer be undone, the driver and
the depot's dispatcher get an in-app notification.

Added (all nullable):
- delivery_runs: arrived_at, arrived_dock_id -> docks, picked_by_id -> loader_users,
  picked_session_id -> loader_sessions, picked_at, release_notified_at
- loader_users.depot (the existing `depot` enum)
- notifications: recipient_user_id -> users, recipient_depot (`depot` enum), dispatch_trip_id -> dispatch_trips
- notificationtype enum value 'RUN_RELEASED'. SQLAlchemy stores the member NAME, so the label is upper case
  like the others. Added in an autocommit block with IF NOT EXISTS, so it is safe to run twice.

Relaxed NOT NULLs (nothing is removed and no existing row changes):
- notifications.outlet_id: a driver's or a dispatcher's notification has no outlet.
- loader_sessions.dock_tablet_id: sign-in no longer needs a dock tablet.

Backfills:
- loader_users.depot: the depot of the loader's home dock; otherwise, when exactly one depot has docks, that
  depot. Loaders still without a depot are logged by id (a warning) and cannot sign in until it is set.
- delivery_runs in flight (not not_started, not gated_out): arrived_at = created_at (departs_at when that is
  empty) and arrived_dock_id = dock_id, so runs being loaded do not vanish from the queue. not_started runs
  stay hidden until their truck arrives.
- release_notified_at = released_at on every run with a release on record (gated-out runs included), so no
  past release sends a notification.

Downgrade drops the added columns. It keeps the two columns nullable and the enum value: restoring NOT NULL
would mean deleting rows, and Postgres cannot drop an enum value.
"""

import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0017_dock_arrival_pick"
down_revision = "0016_sos_photo"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

DEPOTS = ("PELIYAGODA", "KANDY")


def _depot_type(bind):
    if bind.dialect.name == "postgresql":
        return postgresql.ENUM(*DEPOTS, name="depot", create_type=False)
    return sa.Enum(*DEPOTS, name="depot")


def upgrade() -> None:
    bind = op.get_bind()
    depot = _depot_type(bind)

    if bind.dialect.name == "postgresql":
        # ADD VALUE cannot share a transaction with statements that use it on older Postgres; run it alone.
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'RUN_RELEASED'")

    with op.batch_alter_table("delivery_runs") as batch:
        batch.add_column(sa.Column("arrived_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("arrived_dock_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("picked_by_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("picked_session_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("picked_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("release_notified_at", sa.DateTime(), nullable=True))
        batch.create_foreign_key("fk_delivery_runs_arrived_dock_id", "docks", ["arrived_dock_id"], ["id"])
        batch.create_foreign_key("fk_delivery_runs_picked_by_id", "loader_users", ["picked_by_id"], ["id"])
        batch.create_foreign_key(
            "fk_delivery_runs_picked_session_id", "loader_sessions", ["picked_session_id"], ["id"]
        )

    with op.batch_alter_table("loader_users") as batch:
        batch.add_column(sa.Column("depot", depot, nullable=True))

    with op.batch_alter_table("loader_sessions") as batch:
        batch.alter_column("dock_tablet_id", existing_type=sa.Integer(), nullable=True)

    with op.batch_alter_table("notifications") as batch:
        batch.alter_column("outlet_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(sa.Column("recipient_user_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("recipient_depot", depot, nullable=True))
        batch.add_column(sa.Column("dispatch_trip_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_notifications_recipient_user_id", "users", ["recipient_user_id"], ["id"])
        batch.create_foreign_key(
            "fk_notifications_dispatch_trip_id", "dispatch_trips", ["dispatch_trip_id"], ["id"]
        )
        batch.create_index("ix_notifications_recipient_user_id", ["recipient_user_id"])
        batch.create_index("ix_notifications_recipient_depot", ["recipient_depot"])

    _backfill_loader_depots(bind)
    _backfill_runs()


def _backfill_loader_depots(bind) -> None:
    op.execute(
        "UPDATE loader_users SET depot = (SELECT docks.depot FROM docks WHERE docks.id = loader_users.home_dock_id) "
        "WHERE depot IS NULL AND home_dock_id IS NOT NULL"
    )
    depots = [row[0] for row in bind.execute(sa.text("SELECT DISTINCT depot FROM docks")).fetchall()]
    if len(depots) == 1:
        bind.execute(sa.text("UPDATE loader_users SET depot = :depot WHERE depot IS NULL"), {"depot": depots[0]})
    missing = bind.execute(
        sa.text("SELECT id, full_name FROM loader_users WHERE depot IS NULL ORDER BY id")
    ).fetchall()
    if missing:
        log.warning(
            "0017: %d loader(s) have no depot and cannot sign in until it is set: %s",
            len(missing),
            ", ".join(f"#{row[0]} {row[1]}" for row in missing),
        )


def _backfill_runs() -> None:
    op.execute(
        "UPDATE delivery_runs SET arrived_at = COALESCE(created_at, departs_at), arrived_dock_id = dock_id "
        "WHERE arrived_at IS NULL AND status NOT IN ('NOT_STARTED', 'GATED_OUT')"
    )
    op.execute(
        "UPDATE delivery_runs SET release_notified_at = released_at "
        "WHERE released_at IS NOT NULL AND release_notified_at IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("notifications") as batch:
        batch.drop_index("ix_notifications_recipient_depot")
        batch.drop_index("ix_notifications_recipient_user_id")
        batch.drop_constraint("fk_notifications_dispatch_trip_id", type_="foreignkey")
        batch.drop_constraint("fk_notifications_recipient_user_id", type_="foreignkey")
        batch.drop_column("dispatch_trip_id")
        batch.drop_column("recipient_depot")
        batch.drop_column("recipient_user_id")

    with op.batch_alter_table("loader_users") as batch:
        batch.drop_column("depot")

    with op.batch_alter_table("delivery_runs") as batch:
        batch.drop_constraint("fk_delivery_runs_picked_session_id", type_="foreignkey")
        batch.drop_constraint("fk_delivery_runs_picked_by_id", type_="foreignkey")
        batch.drop_constraint("fk_delivery_runs_arrived_dock_id", type_="foreignkey")
        batch.drop_column("release_notified_at")
        batch.drop_column("picked_at")
        batch.drop_column("picked_session_id")
        batch.drop_column("picked_by_id")
        batch.drop_column("arrived_dock_id")
        batch.drop_column("arrived_at")
