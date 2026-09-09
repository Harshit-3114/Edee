"""phase1 initial schema

Revision ID: 001
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

revision = '001'
down_revision = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table('students',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('firebase_uid', sa.Text, unique=True, nullable=False),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('email', sa.Text, unique=True, nullable=False),
        sa.Column('phone', sa.Text, unique=True, nullable=False),
        sa.Column('stream', sa.Text, nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_check_constraint('stream_check', 'students',
                               "stream IN ('UG', 'PG')")

    op.create_table('colleges',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('slug', sa.Text, unique=True, nullable=False),
        sa.Column('location', sa.Text, nullable=False),
        sa.Column('city', sa.Text, nullable=False),
        sa.Column('state', sa.Text, nullable=False),
        sa.Column('type', sa.Text, nullable=False),
        sa.Column('landing_hero_image_url', sa.Text),
        sa.Column('landing_description', sa.Text),
        sa.Column('landing_gallery_urls', JSONB),
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('college_courses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('course_name', sa.Text, nullable=False),
        sa.Column('stream', sa.Text, nullable=False),
        sa.Column('duration_years', sa.Integer),
        sa.Column('seats', sa.Integer),
        sa.Column('application_fee', sa.Integer, nullable=False),
        sa.Column('active', sa.Boolean, default=True),
    )

    op.create_table('shortlists',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('course_id', UUID(as_uuid=True),
                  sa.ForeignKey('college_courses.id'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint('student_id', 'college_id', 'course_id',
                            name='uq_shortlist'),
    )

    op.create_table('orders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('razorpay_order_id', sa.Text, unique=True, nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('currency', sa.Text, default='INR'),
        sa.Column('status', sa.Text, default='created'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('payments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('order_id', UUID(as_uuid=True),
                  sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('razorpay_payment_id', sa.Text, unique=True, nullable=False),
        sa.Column('razorpay_signature', sa.Text, nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('status', sa.Text, default='captured'),
        sa.Column('verified_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('processed_webhooks',
        sa.Column('razorpay_payment_id', sa.Text, primary_key=True),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('college_admins',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('firebase_uid', sa.Text, unique=True, nullable=False),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('email', sa.Text, unique=True, nullable=False),
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('coaching_centers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('city', sa.Text),
        sa.Column('state', sa.Text),
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('coaching_center_admins',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('firebase_uid', sa.Text, unique=True, nullable=False),
        sa.Column('coaching_center_id', UUID(as_uuid=True),
                  sa.ForeignKey('coaching_centers.id'), nullable=False),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('email', sa.Text, unique=True, nullable=False),
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table('student_coaching_links',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('coaching_center_id', UUID(as_uuid=True),
                  sa.ForeignKey('coaching_centers.id'), nullable=False),
        sa.Column('linked_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint('student_id', 'coaching_center_id',
                            name='uq_student_coaching_link'),
    )

    op.create_table('applications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('course_id', UUID(as_uuid=True),
                  sa.ForeignKey('college_courses.id'), nullable=False),
        sa.Column('payment_id', UUID(as_uuid=True),
                  sa.ForeignKey('payments.id')),
        sa.Column('status', sa.Text, default='payment_received'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint('student_id', 'college_id', 'course_id',
                            name='uq_application'),
    )

    op.create_table('audit_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('actor_id', UUID(as_uuid=True)),
        sa.Column('actor_role', sa.Text),
        sa.Column('action', sa.Text, nullable=False),
        sa.Column('entity_type', sa.Text),
        sa.Column('entity_id', UUID(as_uuid=True)),
        sa.Column('metadata', JSONB),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('audit_events')
    op.drop_table('applications')
    op.drop_table('student_coaching_links')
    op.drop_table('coaching_center_admins')
    op.drop_table('coaching_centers')
    op.drop_table('college_admins')
    op.drop_table('processed_webhooks')
    op.drop_table('payments')
    op.drop_table('orders')
    op.drop_table('shortlists')
    op.drop_table('college_courses')
    op.drop_table('colleges')
    op.drop_table('students')