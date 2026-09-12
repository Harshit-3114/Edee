"""scholarship slabs, order totals, and course closing dates

Revision ID: 003
Revises: 002
Create Date: 2026-09-12

1. `scholarship_slabs` holds the volume discount: N forms at once earns a
   fixed discount off the summed fees. Seeded separately (seeds/scholarships)
   so policy changes without a migration.
2. `orders` gains `total_amount` (gross quoted fees) alongside `amount` (what
   was actually charged) and `discount_amount`. Existing rows predate
   discounts, so they are backfilled with total = amount, discount = 0.
3. `college_courses.closing_date` records when applications close. NULL means
   open indefinitely; shortlisting and pricing refuse closed courses, while
   already-paid applications are still honoured.
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"


def upgrade():
    op.create_table(
        "scholarship_slabs",
        sa.Column("min_forms", sa.Integer, primary_key=True),
        sa.Column("discount_paise", sa.Integer, nullable=False),
        sa.CheckConstraint("min_forms > 0", name="slab_forms_positive"),
        sa.CheckConstraint("discount_paise > 0", name="slab_discount_positive"),
    )

    op.add_column(
        "college_courses", sa.Column("closing_date", sa.TIMESTAMP(timezone=True))
    )
    op.create_index(
        "ix_college_courses_closing", "college_courses", ["closing_date"]
    )

    op.add_column("orders", sa.Column("total_amount", sa.Integer))
    op.add_column(
        "orders",
        sa.Column(
            "discount_amount", sa.Integer, nullable=False, server_default="0"
        ),
    )
    # Rows written before discounts existed were charged in full.
    op.execute("UPDATE orders SET total_amount = amount WHERE total_amount IS NULL")
    op.alter_column("orders", "total_amount", nullable=False)


def downgrade():
    op.alter_column("orders", "total_amount", nullable=True)
    op.drop_column("orders", "discount_amount")
    op.drop_column("orders", "total_amount")
    op.drop_index("ix_college_courses_closing", "college_courses")
    op.drop_column("college_courses", "closing_date")
    op.drop_table("scholarship_slabs")
