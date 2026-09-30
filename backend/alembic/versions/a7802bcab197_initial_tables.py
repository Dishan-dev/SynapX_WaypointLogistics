"""initial tables

Revision ID: a7802bcab197
Revises:
Create Date: 2026-09-29 23:24:04.037339

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'a7802bcab197'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline: all tables already exist in the database."""
    pass


def downgrade() -> None:
    """Baseline: nothing to undo."""
    pass
