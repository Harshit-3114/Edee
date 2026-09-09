"""order items, platform roles, and integrity constraints

Revision ID: 002
Revises: 001
Create Date: 2026-09-09

Three things, all of which close a real hole in 001:

1. `order_items` records which shortlist entries an order actually covers.
   Without it the webhook had to guess, and it guessed "everything this student
   ever shortlisted" - so paying for one application created applications for
   all of them.

2. `platform_users` gives internal admins somewhere to live. 001 had
   college_admins and coaching_center_admins but no table for platform staff,
   so the admin role had no durable record behind its claim.

3. Status and role CHECK constraints. `applications.status` was free text, so a
   typo in a router could write a status no UI knows how to render.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "002"
down_revision = "001"


def upgrade():
    # ---- which shortlist entries an order paid for ------------------------
    op.create_table(
        "order_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shortlist_id", UUID(as_uuid=True), nullable=False
        ),  # not an FK: the shortlist row may be removed after paying
        sa.Column(
            "college_id",
            UUID(as_uuid=True),
            sa.ForeignKey("colleges.id"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            UUID(as_uuid=True),
            sa.ForeignKey("college_courses.id"),
            nullable=False,
        ),
        # The fee as quoted at purchase time, in paise. A college raising its
        # fee later must not change what an existing order was worth.
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("order_id", "course_id", name="uq_order_item"),
    )
    op.create_index("ix_order_items_order", "order_items", ["order_id"])

    # ---- internal platform staff -----------------------------------------
    op.create_table(
        "platform_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("firebase_uid", sa.Text, unique=True, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, unique=True, nullable=False),
        sa.Column("role", sa.Text, nullable=False),
        sa.Column("active", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_check_constraint(
        "platform_user_role_check", "platform_users", "role IN ('admin')"
    )

    # ---- integrity -------------------------------------------------------
    op.create_check_constraint(
        "application_status_check",
        "applications",
        """status IN ('payment_received', 'under_review',
                      'accepted', 'rejected', 'withdrawn')""",
    )
    op.add_column("applications", sa.Column("status_note", sa.Text))
    op.add_column("applications", sa.Column("status_changed_by", UUID(as_uuid=True)))
    op.create_index(
        "ix_applications_college_status", "applications", ["college_id", "status"]
    )
    op.create_index("ix_applications_student", "applications", ["student_id"])

    op.create_check_constraint(
        "order_status_check", "orders", "status IN ('created', 'paid', 'failed')"
    )
    # A fee of zero or less is never legitimate and has been the shape of more
    # than one payment bug. Let the database refuse it.
    op.create_check_constraint(
        "course_fee_positive", "college_courses", "application_fee > 0"
    )
    op.create_check_constraint("order_amount_positive", "orders", "amount > 0")

    op.create_index("ix_shortlists_student", "shortlists", ["student_id"])
    op.create_index("ix_orders_student", "orders", ["student_id"])
    op.create_index("ix_college_courses_college", "college_courses", ["college_id"])

    # Invite codes, so a coaching centre can claim a student at signup.
    op.create_table(
        "coaching_invites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "coaching_center_id",
            UUID(as_uuid=True),
            sa.ForeignKey("coaching_centers.id"),
            nullable=False,
        ),
        sa.Column("code", sa.Text, unique=True, nullable=False),
        sa.Column("max_uses", sa.Integer, server_default="100", nullable=False),
        sa.Column("uses", sa.Integer, server_default="0", nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_check_constraint(
        "invite_uses_within_max", "coaching_invites", "uses <= max_uses"
    )


def downgrade():
    op.drop_table("coaching_invites")
    op.drop_index("ix_college_courses_college", "college_courses")
    op.drop_index("ix_orders_student", "orders")
    op.drop_index("ix_shortlists_student", "shortlists")
    op.drop_constraint("order_amount_positive", "orders")
    op.drop_constraint("course_fee_positive", "college_courses")
    op.drop_constraint("order_status_check", "orders")
    op.drop_index("ix_applications_student", "applications")
    op.drop_index("ix_applications_college_status", "applications")
    op.drop_column("applications", "status_changed_by")
    op.drop_column("applications", "status_note")
    op.drop_constraint("application_status_check", "applications")
    op.drop_table("platform_users")
    op.drop_index("ix_order_items_order", "order_items")
    op.drop_table("order_items")
