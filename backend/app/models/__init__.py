"""Convenience re-exports for the API's Pydantic schemas."""

from app.models.student import (
    StudentCreate as StudentCreate,
    StudentResponse as StudentResponse,
    StudentProfile as StudentProfile,
)
from app.models.college import (
    CollegeResponse as CollegeResponse,
    CollegeCourseResponse as CollegeCourseResponse,
)
from app.models.shortlist import (
    ShortlistAdd as ShortlistAdd,
    ShortlistResponse as ShortlistResponse,
)
from app.models.payment import (
    CreateOrder as CreateOrder,
    CreateOrderResponse as CreateOrderResponse,
    VerifyPayment as VerifyPayment,
)

__all__ = [
    "StudentCreate",
    "StudentResponse",
    "StudentProfile",
    "CollegeResponse",
    "CollegeCourseResponse",
    "ShortlistAdd",
    "ShortlistResponse",
    "CreateOrder",
    "CreateOrderResponse",
    "VerifyPayment",
]
