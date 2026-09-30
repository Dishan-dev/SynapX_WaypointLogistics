"""add_orders_management_fields

Revision ID: 0a80c3e0353c
Revises: af60e6fa37a0
Create Date: 2026-09-30 00:55:05.305332

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a80c3e0353c'
down_revision: Union[str, Sequence[str], None] = 'af60e6fa37a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new values to orderstatus enum
    op.execute(sa.text("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'ALLOCATED'"))
    op.execute(sa.text("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'DEFERRED'"))

    op.add_column('orders', sa.Column('brand', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('district', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('temperature_zone', sa.String(length=50), server_default='Ambient', nullable=False))
    op.add_column('orders', sa.Column('delivery_window', sa.String(length=50), nullable=True))
    op.add_column('orders', sa.Column('weight_kg', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('orders', sa.Column('is_priority', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('orders', sa.Column('is_late', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('orders', sa.Column('operating_date', sa.String(length=50), nullable=True))
    op.add_column('orders', sa.Column('deferral_reason', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('orders', 'deferral_reason')
    op.drop_column('orders', 'operating_date')
    op.drop_column('orders', 'is_late')
    op.drop_column('orders', 'is_priority')
    op.drop_column('orders', 'weight_kg')
    op.drop_column('orders', 'delivery_window')
    op.drop_column('orders', 'temperature_zone')
    op.drop_column('orders', 'district')
    op.drop_column('orders', 'brand')
