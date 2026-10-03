"""order loader fields

SHARED MODEL CHANGE - `orders` is read by the dispatcher and driver teams too.

Kept in its own revision, separate from 0002_loader_foundation, so it can be
reverted or held back without unpicking the loader tables.

orders.brand (varchar) and orders.weight_kg (float, NOT NULL, default 0) are not
added here: Nisith's 0a80c3e0353c already has them, and the loader reads those.
The four columns below are additive and nullable, so existing rows and existing
callers are unaffected.

Revision ID: 0003_order_loader_fields
Revises: 0002_loader_foundation
Create Date: 2026-09-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0003_order_loader_fields'
down_revision: Union[str, Sequence[str], None] = '0002_loader_foundation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Named explicitly. Autogenerate emitted an unnamed constraint here, which renders
# as drop_constraint(None, ...) and fails on downgrade.
FK_ORDERS_OUTLET = "fk_orders_outlet_id_outlets"


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    temperature_type = sa.Enum('CHILLED', 'AMBIENT', name='temperatureclass')

    if bind.dialect.name == "postgresql":
        # Unlike create_table(), add_column() does NOT create the named ENUM type
        # first - it just references it and fails if it is missing. Create it
        # explicitly; Order is its only user.
        temperature_type.create(bind, checkfirst=True)

        # create_type=False stops add_column trying to emit CREATE TYPE again.
        temperature_column_type = postgresql.ENUM(
            'CHILLED', 'AMBIENT', name='temperatureclass', create_type=False
        )
    else:
        temperature_column_type = temperature_type

    op.add_column('orders', sa.Column('outlet_id', sa.Integer(), nullable=True))
    op.add_column(
        'orders',
        sa.Column('temperature_class', temperature_column_type, nullable=True),
    )
    op.add_column('orders', sa.Column('units', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('volume_m3', sa.Float(), nullable=True))
    op.create_foreign_key(FK_ORDERS_OUTLET, 'orders', 'outlets', ['outlet_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(FK_ORDERS_OUTLET, 'orders', type_='foreignkey')
    op.drop_column('orders', 'volume_m3')
    op.drop_column('orders', 'units')
    op.drop_column('orders', 'temperature_class')
    op.drop_column('orders', 'outlet_id')

    # temperatureclass is created by this revision (Order is its only user), so it
    # is dropped here.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("DROP TYPE IF EXISTS temperatureclass"))
