"""contact form inbox

Revision ID: 005
Revises: 004
Create Date: 2026-09-18

`contact_messages` stores what visitors send through the public contact
form: name, email, purpose, message. Written by anyone (rate-limited at the
route), read only by platform admins. Purpose is free text capped at 40
characters rather than an enum: the frontend owns the option list and copy
changes should not need a migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"


def upgrade():
    op.create_table(
        "contact_messages",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("purpose", sa.Text, nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_contact_messages_created",
        "contact_messages",
        [sa.text("created_at DESC")],
    )


def downgrade():
    op.drop_index("ix_contact_messages_created", "contact_messages")
    op.drop_table("contact_messages")
