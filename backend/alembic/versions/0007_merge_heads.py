"""merge store manager and dispatcher heads

Store Manager (0006_delivery_issues) and dev (0006_run_dispatch_trip_unique -> c82d14e09f6a) both
branched off 0005. This joins them; it changes no tables.

Revision ID: 0007_merge_heads
Revises: 0006_delivery_issues, c82d14e09f6a
Create Date: 2026-10-03 18:10:21.531349

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = '0007_merge_heads'
down_revision: Union[str, Sequence[str], None] = ('0006_delivery_issues', 'c82d14e09f6a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
