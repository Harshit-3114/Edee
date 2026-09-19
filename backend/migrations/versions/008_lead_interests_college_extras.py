"""lead interests, college phases and logos

Revision ID: 008
Revises: 007
Create Date: 2026-09-19

1. `coaching_students.interests` keeps the raw "shortlisted colleges" column
   from a bulk upload ("Fergusson College :: B.Sc Statistics; ..."). Leads
   are not students yet, so shortlist rows cannot exist for them; the text
   is stored verbatim and resolved into real shortlists when the lead
   registers with the issuing centre's invite code.
2. `colleges.application_phases` is free text for admission rounds
   ("Phase 1: ...; Phase 2: ..."), edited in the admin portal and shown on
   the landing page. Free text, not a table: round wording differs by
   college and changes often.
3. `colleges.logo_url` holds the college mark uploaded through the admin
   portal, served from the backend's uploads directory.
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"


def upgrade():
    op.add_column("coaching_students", sa.Column("interests", sa.Text))
    op.add_column("colleges", sa.Column("application_phases", sa.Text))
    op.add_column("colleges", sa.Column("logo_url", sa.Text))


def downgrade():
    op.drop_column("colleges", "logo_url")
    op.drop_column("colleges", "application_phases")
    op.drop_column("coaching_students", "interests")
