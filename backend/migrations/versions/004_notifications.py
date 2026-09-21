"""per-user notification inbox

Revision ID: 004
Revises: 003
Create Date: 2026-09-18

`notifications` is a plain inbox: one row per event per recipient, read by
setting `read_at`. Recipients are addressed by Firebase UID straight from the
verified token, so no join to role tables is needed to list a user's own
notifications, and a user can never read another's (every query filters on
the token UID).

Writers: application status changes notify the student; captured payments
notify the college admins of each college in the order.
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("recipient_uid", sa.Text, nullable=False),
        sa.Column("role", sa.Text, nullable=False),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("body", sa.Text),
        sa.Column("link", sa.Text),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_notifications_recipient_created",
        "notifications",
        ["recipient_uid", sa.text("created_at DESC")],
    )


def downgrade():
    op.drop_index("ix_notifications_recipient_created", "notifications")
    op.drop_table("notifications")
