"""delivery_stops: outlet_id and eta

Each driver stop names the store it delivers to (outlet names aren't unique),
and carries the time the truck is expected there, so every store sees its own
ETA and arrival time instead of the whole trip's.

Additive only: two nullable columns, an index and a foreign key. Stops copied
before this have no outlet_id; the driver service fills it in from the loader
run when the trip starts.

Revision ID: 0014_delivery_stop_outlet_eta
Revises: 0013_driver_availability
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0014_delivery_stop_outlet_eta"
down_revision: Union[str, Sequence[str], None] = "0013_driver_availability"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK = "fk_delivery_stops_outlet_id_outlets"
INDEX = "ix_delivery_stops_outlet_id"


def upgrade() -> None:
    with op.batch_alter_table("delivery_stops") as batch:
        batch.add_column(sa.Column("outlet_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("eta", sa.DateTime(), nullable=True))
        batch.create_foreign_key(FK, "outlets", ["outlet_id"], ["id"])
        batch.create_index(INDEX, ["outlet_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("delivery_stops") as batch:
        batch.drop_index(INDEX)
        batch.drop_constraint(FK, type_="foreignkey")
        batch.drop_column("eta")
        batch.drop_column("outlet_id")
