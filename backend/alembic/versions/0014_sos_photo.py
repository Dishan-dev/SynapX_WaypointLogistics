"""Remember the photo a driver attaches to an SOS.

Revision ID: 0014_sos_photo
Revises: 0013_driver_availability

The driver app uploads the photo (Cloudflare R2) and sends its link with the SOS; until now sos_alerts had
nowhere to keep it. One optional column, nothing else changes.
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_sos_photo"
down_revision = "0013_driver_availability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sos_alerts", sa.Column("photo_url", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("sos_alerts") as batch:
        batch.drop_column("photo_url")
