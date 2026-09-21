"""coaching uploads and commercial tracking

Revision ID: 007
Revises: 006
Create Date: 2026-09-19

Two things the partner portal needs:

1. `coaching_uploads` + `coaching_students` record bulk CSV uploads per
   centre. The students table only holds signed-up accounts, so uploads need
   their own durable rows: every file an institute ever sent stays visible,
   and email is unique per centre so re-uploading a file cannot duplicate
   leads. `status` follows a lead from `uploaded` to `signed_up` once the
   student registers with the issuing centre's invite code.

2. `coaching_centers` gains `amount_per_lead` (paise charged per submitted
   lead, set by an admin) and `credit_paise` (payments/waivers the platform
   extends). Outstanding is derived, never stored: leads x rate - credit.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "007"
down_revision = "006"


def upgrade():
    op.create_table(
        "coaching_uploads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "coaching_center_id",
            UUID(as_uuid=True),
            sa.ForeignKey("coaching_centers.id"),
            nullable=False,
        ),
        sa.Column("filename", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="processed"),
        sa.Column("records_total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("records_created", sa.Integer, nullable=False, server_default="0"),
        sa.Column("records_duplicate", sa.Integer, nullable=False, server_default="0"),
        sa.Column("records_error", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_coaching_uploads_centre", "coaching_uploads", ["coaching_center_id"]
    )

    op.create_table(
        "coaching_students",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "upload_id",
            UUID(as_uuid=True),
            sa.ForeignKey("coaching_uploads.id"),
        ),
        sa.Column(
            "coaching_center_id",
            UUID(as_uuid=True),
            sa.ForeignKey("coaching_centers.id"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("phone", sa.Text),
        sa.Column("stream", sa.Text),
        sa.Column("status", sa.Text, nullable=False, server_default="uploaded"),
        sa.Column("student_id", UUID(as_uuid=True), sa.ForeignKey("students.id")),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("coaching_center_id", "email", name="uq_coaching_student"),
    )
    op.create_check_constraint(
        "coaching_student_stream_check",
        "coaching_students",
        "stream IS NULL OR stream IN ('UG', 'PG')",
    )
    op.create_check_constraint(
        "coaching_student_status_check",
        "coaching_students",
        "status IN ('uploaded', 'signed_up')",
    )
    op.create_index(
        "ix_coaching_students_centre", "coaching_students", ["coaching_center_id"]
    )

    op.add_column(
        "coaching_centers",
        sa.Column("amount_per_lead", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "coaching_centers",
        sa.Column("credit_paise", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "centre_rate_non_negative", "coaching_centers", "amount_per_lead >= 0"
    )
    op.create_check_constraint(
        "centre_credit_non_negative", "coaching_centers", "credit_paise >= 0"
    )


def downgrade():
    op.drop_constraint("centre_credit_non_negative", "coaching_centers")
    op.drop_constraint("centre_rate_non_negative", "coaching_centers")
    op.drop_column("coaching_centers", "credit_paise")
    op.drop_column("coaching_centers", "amount_per_lead")
    op.drop_index("ix_coaching_students_centre", "coaching_students")
    op.drop_constraint("coaching_student_status_check", "coaching_students")
    op.drop_constraint("coaching_student_stream_check", "coaching_students")
    op.drop_table("coaching_students")
    op.drop_index("ix_coaching_uploads_centre", "coaching_uploads")
    op.drop_table("coaching_uploads")
