"""unique_run_id_on_allocations + fix weekly_fuel_status default

Revision ID: af60e6fa37a0
Revises: 552931e83b93
Create Date: 2026-09-29 23:19:43.510717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af60e6fa37a0'
down_revision: Union[str, Sequence[str], None] = '552931e83b93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Promote run_id index to unique so loader FK is safe
    op.drop_index(op.f('ix_allocations_run_id'), table_name='allocations')
    op.create_index(op.f('ix_allocations_run_id'), 'allocations', ['run_id'], unique=True)

    # Fix copy-paste in 552931e83b93: weekly_fuel_status had server_default='Ambient'
    # (same as temperature_mode). Correct default is 'Within quota'.
    op.alter_column(
        'vehicles', 'weekly_fuel_status',
        existing_type=sa.String(length=50),
        server_default='Within quota',
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revert weekly_fuel_status default
    op.alter_column(
        'vehicles', 'weekly_fuel_status',
        existing_type=sa.String(length=50),
        server_default='Ambient',
        existing_nullable=False,
    )
    # Revert unique index
    op.drop_index(op.f('ix_allocations_run_id'), table_name='allocations')
    op.create_index(op.f('ix_allocations_run_id'), 'allocations', ['run_id'], unique=False)
