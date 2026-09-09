import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.tables import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    phone = Column(Text, unique=True, nullable=False)
    stream = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

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
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

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
    active = Column(Boolean, default=True)

    college = relationship("College", back_populates="courses")
    shortlists = relationship("Shortlist", back_populates="course")
    applications = relationship("Application", back_populates="course")


class Shortlist(Base):
    __tablename__ = "shortlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("college_courses.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

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
    currency = Column(Text, default="INR")
    status = Column(Text, default="created")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    student = relationship("Student", back_populates="orders")
    payments = relationship("Payment", back_populates="order")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    razorpay_payment_id = Column(Text, unique=True, nullable=False)
    razorpay_signature = Column(Text, nullable=False)
    amount = Column(Integer, nullable=False)
    status = Column(Text, default="captured")
    verified_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    order = relationship("Order", back_populates="payments")
    applications = relationship("Application", back_populates="payment")


class ProcessedWebhook(Base):
    __tablename__ = "processed_webhooks"

    razorpay_payment_id = Column(Text, primary_key=True)
    processed_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class CollegeAdmin(Base):
    __tablename__ = "college_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(Text, unique=True, nullable=False)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    college = relationship("College", back_populates="admins")


class CoachingCenter(Base):
    __tablename__ = "coaching_centers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    city = Column(Text)
    state = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

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
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    coaching_center = relationship("CoachingCenter", back_populates="admins")


class StudentCoachingLink(Base):
    __tablename__ = "student_coaching_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    coaching_center_id = Column(UUID(as_uuid=True), ForeignKey("coaching_centers.id"), nullable=False)
    linked_at = Column(DateTime(timezone=True), default=datetime.utcnow)

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
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("student_id", "college_id", "course_id", name="uq_application"),
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
    event_metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)