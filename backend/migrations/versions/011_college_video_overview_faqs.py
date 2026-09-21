"""college landing video, overview and FAQs

Revision ID: 011
Revises: 010
Create Date: 2026-09-21

The public landing page renders a campus video, a long-form overview and an
FAQ list, and the seeds carry content for all three - but no migration in
this chain ever created the columns. (A copy of this change lived outside the
chain with no down_revision, where Alembic never reads it.) Nullable, so
existing rows are untouched and colleges without content simply hide those
sections.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "011"
down_revision = "010"


def upgrade():
    op.add_column("colleges", sa.Column("video_url", sa.Text(), nullable=True))
    op.add_column("colleges", sa.Column("overview", sa.Text(), nullable=True))
    op.add_column("colleges", sa.Column("faqs", JSONB(), nullable=True))


def downgrade():
    op.drop_column("colleges", "faqs")
    op.drop_column("colleges", "overview")
    op.drop_column("colleges", "video_url")
