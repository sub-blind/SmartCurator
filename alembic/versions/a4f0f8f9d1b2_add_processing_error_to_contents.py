"""add processing_error to contents

Revision ID: a4f0f8f9d1b2
Revises: 820cf154f16e
Create Date: 2026-03-30 10:40:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4f0f8f9d1b2"
down_revision: Union[str, None] = "820cf154f16e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contents", sa.Column("processing_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("contents", "processing_error")
