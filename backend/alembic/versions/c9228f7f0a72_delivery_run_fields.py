"""delivery_run_fields

Revision ID: c9228f7f0a72
Revises: af60e6fa37a0
Create Date: 2026-09-30 12:21:04.748983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9228f7f0a72'
down_revision: Union[str, Sequence[str], None] = 'af60e6fa37a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('dispatch_trips', sa.Column('allocation_id', sa.Integer(), sa.ForeignKey('allocations.id'), nullable=True))
    op.add_column('dispatch_trips', sa.Column('status', sa.String(50), nullable=False, server_default='scheduled'))
    op.add_column('dispatch_trips', sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.id'), nullable=True))
    op.add_column('dispatch_trips', sa.Column('driver_id', sa.Integer(), sa.ForeignKey('driver_profiles.id'), nullable=True))
    op.add_column('dispatch_trips', sa.Column('depot_name', sa.String(50), nullable=True))
    op.add_column('dispatch_trips', sa.Column('total_weight_kg', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('dispatch_trips', sa.Column('total_volume_m3', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('dispatch_trips', sa.Column('stop_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('dispatch_trips', sa.Column('stops_completed', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('dispatch_trips', sa.Column('stop_sequence', sa.JSON(), nullable=True))
    op.add_column('dispatch_trips', sa.Column('open_shortfalls', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('dispatch_trips', sa.Column('loading_events', sa.JSON(), nullable=True))
    op.add_column('dispatch_trips', sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')))
    op.add_column('dispatch_trips', sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('dispatch_trips', 'updated_at')
    op.drop_column('dispatch_trips', 'created_at')
    op.drop_column('dispatch_trips', 'loading_events')
    op.drop_column('dispatch_trips', 'open_shortfalls')
    op.drop_column('dispatch_trips', 'stop_sequence')
    op.drop_column('dispatch_trips', 'stops_completed')
    op.drop_column('dispatch_trips', 'stop_count')
    op.drop_column('dispatch_trips', 'total_volume_m3')
    op.drop_column('dispatch_trips', 'total_weight_kg')
    op.drop_column('dispatch_trips', 'depot_name')
    op.drop_column('dispatch_trips', 'driver_id')
    op.drop_column('dispatch_trips', 'vehicle_id')
    op.drop_column('dispatch_trips', 'status')
    op.drop_column('dispatch_trips', 'allocation_id')
