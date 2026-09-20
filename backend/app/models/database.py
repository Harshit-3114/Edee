import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Text, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint, func, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.tables import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    phone = Column(Text, unique=True, nullable=False)
    stream = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        CheckConstraint("stream IN ('UG', 'PG')", name="stream_check"),
    )

    shortlists = relationship("Shortlist", back_populates="student")
    orders = relationship("Order", back_populates="student")
    applications = relationship("Application", back_populates="student")
    coaching_links = relationship("StudentCoachingLink", back_populates="student")


class College(Base):
    __tablename__ = "colleges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    slug = Column(Text, unique=True, nullable=False)
    location = Column(Text, nullable=False)
    city = Column(Text, nullable=False)
    state = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    landing_hero_image_url = Column(Text)
    landing_description = Column(Text)
    landing_gallery_urls = Column(JSONB)
    # Free-text admission rounds, edited in the admin portal and shown on
    # the public landing page.
    application_phases = Column(Text)
    # College mark uploaded through the admin portal.
    logo_url = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    courses = relationship("CollegeCourse", back_populates="college")
    admins = relationship("CollegeAdmin", back_populates="college")
    shortlists = relationship("Shortlist", back_populates="college")
    applications = relationship("Application", back_populates="college")


class CollegeCourse(Base):
    __tablename__ = "college_courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    course_name = Column(Text, nullable=False)
    stream = Column(Text, nullable=False)
    duration_years = Column(Integer)
    seats = Column(Integer)
    application_fee = Column(Integer, nullable=False)
    # When applications close. NULL means open indefinitely. A closed course
    # can be shortlisted against no longer, but paid applications are still
    # honoured: money taken is a promise kept.
    closing_date = Column(DateTime(timezone=True))
    # When applications open. NULL means already open: existing rows and
    # courses that open immediately carry no start date.
    application_start_date = Column(DateTime(timezone=True))
    # Free text ("Fall 2027"). An enum would need a migration every time
    # admissions wording changes, which is often.
    intake_info = Column(Text)
    active = Column(Boolean, default=True)

    __table_args__ = (
        CheckConstraint("application_fee > 0", name="course_fee_positive"),
    )

    college = relationship("College", back_populates="courses")
    shortlists = relationship("Shortlist", back_populates="course")
    applications = relationship("Application", back_populates="course")


class Shortlist(Base):
    __tablename__ = "shortlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("college_courses.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("student_id", "college_id", "course_id", name="uq_shortlist"),
    )

    student = relationship("Student", back_populates="shortlists")
    college = relationship("College", back_populates="shortlists")
    course = relationship("CollegeCourse", back_populates="shortlists")


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    razorpay_order_id = Column(Text, unique=True, nullable=False)
    amount = Column(Integer, nullable=False)
    # Gross quoted total and scholarship discount, both paise. amount is what
    # Razorpay charged (gross minus discount); the two are kept apart so
    # receipts can show the maths instead of a single inscrutable number.
    total_amount = Column(Integer, nullable=False)
    discount_amount = Column(Integer, nullable=False, default=0)
    currency = Column(Text, default="INR")
    status = Column(Text, default="created")
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('created', 'paid', 'failed')", name="order_status_check"),
        CheckConstraint("amount > 0", name="order_amount_positive"),
    )

    student = relationship("Student", back_populates="orders")
    payments = relationship("Payment", back_populates="order")
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Not an FK: the shortlist row may be removed after paying.
    shortlist_id = Column(UUID(as_uuid=True), nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    course_id = Column(
        UUID(as_uuid=True), ForeignKey("college_courses.id"), nullable=False
    )
    # Fee as quoted at purchase, in paise.
    amount = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("order_id", "course_id", name="uq_order_item"),
    )

    order = relationship("Order", back_populates="items")


class ScholarshipSlab(Base):
    """
    OneApply-style volume discount: applying to N courses at once earns a
    discount of discount_paise off the summed fees. Beyond the largest slab
    the discount grows per form (see scholarship_for_count in payments).
    Seeded from scripts, tunable without a deploy.
    """

    __tablename__ = "scholarship_slabs"

    min_forms = Column(Integer, primary_key=True)
    discount_paise = Column(Integer, nullable=False)

    __table_args__ = (
        CheckConstraint("min_forms > 0", name="slab_forms_positive"),
        CheckConstraint("discount_paise > 0", name="slab_discount_positive"),
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    razorpay_payment_id = Column(Text, unique=True, nullable=False)
    razorpay_signature = Column(Text, nullable=False)
    amount = Column(Integer, nullable=False)
    status = Column(Text, default="captured")
    verified_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    order = relationship("Order", back_populates="payments")
    applications = relationship("Application", back_populates="payment")


class ProcessedWebhook(Base):
    __tablename__ = "processed_webhooks"

    razorpay_payment_id = Column(Text, primary_key=True)
    processed_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())


class CollegeAdmin(Base):
    __tablename__ = "college_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(Text, unique=True, nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    college = relationship("College", back_populates="admins")


class CoachingCenter(Base):
    __tablename__ = "coaching_centers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    city = Column(Text)
    state = Column(Text)
    active = Column(Boolean, default=True)
    # Commercial terms, both paise. Outstanding is derived (leads x rate -
    # credit), never stored, so the dashboard and the admin panel cannot
    # disagree about what an institute owes.
    amount_per_lead = Column(Integer, nullable=False, default=0, server_default=text("0"))
    credit_paise = Column(Integer, nullable=False, default=0, server_default=text("0"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        CheckConstraint("amount_per_lead >= 0", name="centre_rate_non_negative"),
        CheckConstraint("credit_paise >= 0", name="centre_credit_non_negative"),
    )

    admins = relationship("CoachingCenterAdmin", back_populates="coaching_center")
    student_links = relationship("StudentCoachingLink", back_populates="coaching_center")


class CoachingCenterAdmin(Base):
    __tablename__ = "coaching_center_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(Text, unique=True, nullable=False)
    coaching_center_id = Column(UUID(as_uuid=True), ForeignKey("coaching_centers.id"), nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    coaching_center = relationship("CoachingCenter", back_populates="admins")


class StudentCoachingLink(Base):
    __tablename__ = "student_coaching_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    coaching_center_id = Column(UUID(as_uuid=True), ForeignKey("coaching_centers.id"), nullable=False)
    linked_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("student_id", "coaching_center_id", name="uq_student_coaching_link"),
    )

    student = relationship("Student", back_populates="coaching_links")
    coaching_center = relationship("CoachingCenter", back_populates="student_links")


class Application(Base):
    __tablename__ = "applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("college_courses.id"), nullable=False)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"))
    status = Column(Text, default="payment_received")
    status_note = Column(Text)
    status_changed_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now(), onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint("student_id", "college_id", "course_id", name="uq_application"),
        CheckConstraint(
            "status IN ('payment_received', 'under_review', 'accepted', 'rejected', 'withdrawn')",
            name="application_status_check",
        ),
    )

    student = relationship("Student", back_populates="applications")
    college = relationship("College", back_populates="applications")
    course = relationship("CollegeCourse", back_populates="applications")
    payment = relationship("Payment", back_populates="applications")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True))
    actor_role = Column(Text)
    action = Column(Text, nullable=False)
    entity_type = Column(Text)
    entity_id = Column(UUID(as_uuid=True))
    # Column is named "metadata" in the database; the Python attribute is
    # "event_metadata" because "metadata" collides with SQLAlchemy's own
    # DeclarativeBase.metadata attribute.
    event_metadata = Column("metadata", JSONB)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())


class Notification(Base):
    """
    One inbox row per event per recipient.

    Addressed by Firebase UID from the verified token, so listing needs no
    join and ownership is a WHERE clause, not application logic.
    """

    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_uid = Column(Text, nullable=False)
    role = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    body = Column(Text)
    link = Column(Text)
    read_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())


class ContactMessage(Base):
    """A message sent through the public contact form."""

    __tablename__ = "contact_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    purpose = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())


class PlatformUser(Base):
    __tablename__ = "platform_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    role = Column(Text, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('admin')", name="platform_user_role_check"),
    )


class CoachingInvite(Base):
    __tablename__ = "coaching_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coaching_center_id = Column(
        UUID(as_uuid=True), ForeignKey("coaching_centers.id"), nullable=False
    )
    code = Column(Text, unique=True, nullable=False)
    max_uses = Column(Integer, nullable=False, default=100, server_default=text("100"))
    uses = Column(Integer, nullable=False, default=0, server_default=text("0"))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        CheckConstraint("uses <= max_uses", name="invite_uses_within_max"),
    )


class CoachingUpload(Base):
    """One bulk file an institute sent. The counters are the audit trail:
    re-uploading the same file bumps duplicates, never creates rows."""

    __tablename__ = "coaching_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coaching_center_id = Column(
        UUID(as_uuid=True), ForeignKey("coaching_centers.id"), nullable=False
    )
    filename = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="processed", server_default=text("'processed'"))
    records_total = Column(Integer, nullable=False, default=0, server_default=text("0"))
    records_created = Column(Integer, nullable=False, default=0, server_default=text("0"))
    records_duplicate = Column(Integer, nullable=False, default=0, server_default=text("0"))
    records_error = Column(Integer, nullable=False, default=0, server_default=text("0"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())


class CoachingStudent(Base):
    """A lead from a bulk upload. Email is unique per centre: the file, the
    platform, and a second upload all converge here instead of duplicating."""

    __tablename__ = "coaching_students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    upload_id = Column(UUID(as_uuid=True), ForeignKey("coaching_uploads.id"))
    coaching_center_id = Column(
        UUID(as_uuid=True), ForeignKey("coaching_centers.id"), nullable=False
    )
    name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    phone = Column(Text)
    stream = Column(Text)
    # Raw "shortlisted colleges" column from the upload that created this
    # lead. Resolved into real shortlist rows when the lead registers.
    interests = Column(Text)
    status = Column(Text, nullable=False, default="uploaded", server_default=text("'uploaded'"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("coaching_center_id", "email", name="uq_coaching_student"),
        CheckConstraint(
            "stream IS NULL OR stream IN ('UG', 'PG')",
            name="coaching_student_stream_check",
        ),
        CheckConstraint(
            "status IN ('uploaded', 'signed_up')",
            name="coaching_student_status_check",
        ),
    )

class AuthCredential(Base):
    """
    An email/password account.

    `uid` is the bridge to everything else: it is written into the
    `firebase_uid` column of whichever identity table matches the role
    (students, college_admins, coaching_center_admins, platform_users), so
    ownership queries and role guards never need to know which sign-in path
    produced the identity holding them.
    """

    __tablename__ = "auth_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uid = Column(Text, unique=True, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(Text, nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"))
    coaching_centre_id = Column(UUID(as_uuid=True), ForeignKey("coaching_centers.id"))
    active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    # Rides in every token issued to this account. Bumping it invalidates all
    # of them at once - the local equivalent of revoking refresh tokens.
    token_version = Column(Integer, nullable=False, default=0, server_default=text("0"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())
    password_changed_at = Column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('student', 'college', 'coaching', 'admin')",
            name="auth_credential_role_check",
        ),
        CheckConstraint(
            "(role <> 'college') OR (college_id IS NOT NULL)",
            name="auth_credential_college_scope",
        ),
        CheckConstraint(
            "(role <> 'coaching') OR (coaching_centre_id IS NOT NULL)",
            name="auth_credential_coaching_scope",
        ),
    )


class AuthInvite(Base):
    """
    A single-use set-password link for a college or coaching account.

    Only the hash of the token is here. The token itself is in the link the
    admin copies, and nowhere else, so this table leaking does not hand
    anybody a staff account.
    """

    __tablename__ = "auth_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash = Column(Text, unique=True, nullable=False)
    email = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    role = Column(Text, nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"))
    coaching_centre_id = Column(UUID(as_uuid=True), ForeignKey("coaching_centers.id"))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('college', 'coaching')", name="auth_invite_role_check"),
        CheckConstraint(
            "(role <> 'college') OR (college_id IS NOT NULL)",
            name="auth_invite_college_scope",
        ),
        CheckConstraint(
            "(role <> 'coaching') OR (coaching_centre_id IS NOT NULL)",
            name="auth_invite_coaching_scope",
        ),
    )
