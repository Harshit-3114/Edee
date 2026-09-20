"""local email/password credentials and staff invites

Revision ID: 010
Revises: 009
Create Date: 2026-09-20

Identity has so far been Firebase's entirely: every table keys off a
`firebase_uid`, and `middleware/auth.py` verifies Firebase tokens. With no
service account available, nobody can sign in at all.

These two tables add a second identity path that stands on its own.

`auth_credentials` holds the email, the bcrypt hash and the role. Its `uid`
column is the bridge: a `local:<uuid>` string written into the existing
`firebase_uid` columns, so every ownership query and role guard in the
codebase keeps working without being touched. The `firebase_uid` name stays
because renaming it would rewrite every query for no behavioural gain, and it
becomes accurate again the day a service account shows up.

`auth_invites` backs the college and coaching set-password links. Only the
sha256 of the token is stored - the raw token exists once, inside the link
handed to the admin - so a leak of this table does not hand out staff
accounts.

Students sign themselves up. College and coaching accounts arrive by invite.
The admin is seeded. Nothing here creates an account by itself.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "010"
down_revision = "009"


def upgrade():
    op.create_table(
        "auth_credentials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        # Written into students.firebase_uid, college_admins.firebase_uid and
        # friends. Unique here as well as there: two credentials sharing a uid
        # would be two people holding one identity.
        sa.Column("uid", sa.Text, nullable=False, unique=True),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("role", sa.Text, nullable=False),
        sa.Column("college_id", UUID(as_uuid=True), sa.ForeignKey("colleges.id")),
        sa.Column(
            "coaching_centre_id",
            UUID(as_uuid=True),
            sa.ForeignKey("coaching_centers.id"),
        ),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        # Embedded in every token this account is issued. Bumping it rejects
        # every outstanding session at once, which is what makes a local
        # session revocable the way a Firebase one is.
        sa.Column("token_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "password_changed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('student', 'college', 'coaching', 'admin')",
            name="auth_credential_role_check",
        ),
        # A college credential with no college scopes to nothing, and
        # current_college_id would 403 on every request. Refuse the row
        # instead of writing an account that cannot be used.
        sa.CheckConstraint(
            "(role <> 'college') OR (college_id IS NOT NULL)",
            name="auth_credential_college_scope",
        ),
        sa.CheckConstraint(
            "(role <> 'coaching') OR (coaching_centre_id IS NOT NULL)",
            name="auth_credential_coaching_scope",
        ),
    )

    # Sign-in looks an account up by email on every attempt. Unique already
    # indexes it; this is the lookup the login path actually makes.
    op.create_index(
        "ix_auth_credentials_role", "auth_credentials", ["role"]
    )

    op.create_table(
        "auth_invites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("role", sa.Text, nullable=False),
        sa.Column("college_id", UUID(as_uuid=True), sa.ForeignKey("colleges.id")),
        sa.Column(
            "coaching_centre_id",
            UUID(as_uuid=True),
            sa.ForeignKey("coaching_centers.id"),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # Students never arrive this way - they sign themselves up - and an
        # admin invite would be a way to mint platform staff from a link.
        sa.CheckConstraint(
            "role IN ('college', 'coaching')", name="auth_invite_role_check"
        ),
        sa.CheckConstraint(
            "(role <> 'college') OR (college_id IS NOT NULL)",
            name="auth_invite_college_scope",
        ),
        sa.CheckConstraint(
            "(role <> 'coaching') OR (coaching_centre_id IS NOT NULL)",
            name="auth_invite_coaching_scope",
        ),
    )


def downgrade():
    op.drop_table("auth_invites")
    op.drop_index("ix_auth_credentials_role", table_name="auth_credentials")
    op.drop_table("auth_credentials")
