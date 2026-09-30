"""add loading_tasks and delivery_receipts

Revision ID: f7c819a3b2e1
Revises: af60e6fa37a0
Create Date: 2026-09-30 13:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f7c819a3b2e1'
down_revision: Union[str, Sequence[str], None] = 'af60e6fa37a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. loading_tasks
    op.create_table(
        'loading_tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vehicle_id', sa.String(length=10), nullable=False),
        sa.Column('assigned_loader_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=25), nullable=False, server_default='pending'),
        sa.Column('loaded_units', sa.Integer(), nullable=True),
        sa.Column('shortfall_notes', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_loading_tasks_order_id_orders')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_loading_tasks'))
    )
    op.create_index(op.f('ix_loading_tasks_order_id'), 'loading_tasks', ['order_id'], unique=False)
    op.create_index(op.f('ix_loading_tasks_vehicle_id'), 'loading_tasks', ['vehicle_id'], unique=False)

    # 2. delivery_receipts
    op.create_table(
        'delivery_receipts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('outlet_id', sa.String(length=10), nullable=False),
        sa.Column('units_received', sa.Integer(), nullable=True),
        sa.Column('weight_received_kg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('has_issues', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('issue_type', sa.String(length=30), nullable=True),
        sa.Column('issue_description', sa.Text(), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('synced_from_offline', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_delivery_receipts_order_id_orders')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_delivery_receipts'))
    )
    op.create_index(op.f('ix_delivery_receipts_order_id'), 'delivery_receipts', ['order_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_delivery_receipts_order_id'), table_name='delivery_receipts')
    op.drop_table('delivery_receipts')
    op.drop_index(op.f('ix_loading_tasks_vehicle_id'), table_name='loading_tasks')
    op.drop_index(op.f('ix_loading_tasks_order_id'), table_name='loading_tasks')
    op.drop_table('loading_tasks')
