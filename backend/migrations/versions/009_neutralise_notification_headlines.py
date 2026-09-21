"""neutralise old student notification headlines

Revision ID: 009
Revises: 008
Create Date: 2026-09-19

The student site shows no verdicts: status-change notifications are titled
"Update on your application for <course> at <college>". Rows written before
that change still carry the old "Accepted: ... / Rejected: ... / Under
review: ..." headlines, so rewrite them in place. Only student
application_status rows matching the old "<headline>: <course> at <college>"
shape are touched; payment receipts and college notifications are left alone.

Irreversible by nature (the old headline is the data being removed), so
downgrade is a documented no-op.
"""
from alembic import op

revision = "009"
down_revision = "008"


def upgrade():
    op.execute(
        """
        UPDATE notifications
        SET title = regexp_replace(
            title,
            '^[^:]+: (.*) at (.*)$',
            'Update on your application for \\1 at \\2'
        )
        WHERE role = 'student'
          AND type = 'application_status'
          AND title ~ '^[^:]+: .* at .*$'
        """
    )


def downgrade():
    # The previous headlines held the verdicts this migration removes;
    # there is nothing faithful to restore.
    pass
