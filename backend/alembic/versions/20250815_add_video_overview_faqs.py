"""add video_url, overview, faqs to colleges

Revision ID: 20250815_add_video_overview_faqs
Revises: 
Create Date: 2025-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "20250815_add_video_overview_faqs"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "colleges",
        sa.Column("video_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "colleges",
        sa.Column("overview", sa.Text(), nullable=True),
    )
    op.add_column(
        "colleges",
        sa.Column("faqs", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("colleges", "faqs")
    op.drop_column("colleges", "overview")
    op.drop_column("colleges", "video_url")