"""application windows on courses

Revision ID: 006
Revises: 005
Create Date: 2026-09-19

`college_courses` gains the two fields the admin panel and student pages
need to show an application window rather than just a deadline:

1. `application_start_date` records when applications open. NULL means
   "already open" - existing rows and courses that open immediately.
2. `intake_info` is free text ("Fall 2027", "July intake") capped at 200
   characters. Free text rather than an enum: admissions cycles differ by
   college, and copy changes should not need a migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"


def upgrade():
    op.add_column(
        "college_courses",
        sa.Column("application_start_date", sa.TIMESTAMP(timezone=True)),
    )
    op.add_column("college_courses", sa.Column("intake_info", sa.Text))
    op.create_index(
        "ix_college_courses_start", "college_courses", ["application_start_date"]
    )


def downgrade():
    op.drop_index("ix_college_courses_start", "college_courses")
    op.drop_column("college_courses", "intake_info")
    op.drop_column("college_courses", "application_start_date")
