"""Add dedicated outlet directory, contacts and receiving windows.

Revision ID: c82d14e09f6a
Revises: af60e6fa37a0
"""
from alembic import op
import sqlalchemy as sa

revision = "c82d14e09f6a"
down_revision = "af60e6fa37a0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "outlets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("district", sa.String(100)),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("delivery_restrictions", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_outlets_code", "outlets", ["code"], unique=True)
    op.create_table(
        "outlet_contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("outlet_id", sa.Integer(), sa.ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("role", sa.String(100)),
        sa.Column("phone", sa.String(40)),
        sa.Column("email", sa.String(255)),
    )
    op.create_index("ix_outlet_contacts_outlet_id", "outlet_contacts", ["outlet_id"])
    op.create_table(
        "outlet_receiving_windows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("outlet_id", sa.Integer(), sa.ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("opens_at", sa.Time(), nullable=False),
        sa.Column("closes_at", sa.Time(), nullable=False),
        sa.UniqueConstraint("outlet_id", "weekday", "opens_at", "closes_at", name="uq_outlet_window"),
    )
    op.create_index("ix_outlet_receiving_windows_outlet_id", "outlet_receiving_windows", ["outlet_id"])


def downgrade():
    op.drop_index("ix_outlet_receiving_windows_outlet_id", table_name="outlet_receiving_windows")
    op.drop_table("outlet_receiving_windows")
    op.drop_index("ix_outlet_contacts_outlet_id", table_name="outlet_contacts")
    op.drop_table("outlet_contacts")
    op.drop_index("ix_outlets_code", table_name="outlets")
    op.drop_table("outlets")
