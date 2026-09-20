"""
Request and response shapes for the local email/password path.

The password rules live here rather than in the router so every endpoint that
accepts one - signup, invite acceptance, password change - enforces the same
thing, and so a password that cannot be hashed is a 422 at the edge instead of
an exception from inside bcrypt.
"""
import re
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.services.passwords import MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH

PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def _check_password(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )
    # Bytes, not characters: bcrypt's ceiling is 72 bytes and one emoji is
    # four of them. Rejected here so it reads as a validation error.
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return value


class PasswordField(BaseModel):
    """Mixin for the three bodies that carry a new password."""

    password: str

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        return _check_password(value)


class SignupIn(PasswordField):
    """
    Student signup. No role field: this endpoint only ever makes students.

    College and coaching accounts arrive by invite and the admin is seeded, so
    a role in the body would be a way to ask for one.
    """

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str
    stream: Literal["UG", "PG"]
    invite_code: Optional[str] = Field(default=None, max_length=20)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)[-10:]
        if not PHONE_RE.match(digits):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return digits

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("invite_code")
    @classmethod
    def _invite(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().upper()
        return cleaned or None


class LoginIn(BaseModel):
    email: EmailStr
    # Not length-validated. A wrong password is a wrong password; telling
    # somebody their guess was too short is a hint about the real one.
    password: str = Field(max_length=1024)


class TokenOut(BaseModel):
    token: str
    expires_in: int
    role: str
    college_id: Optional[str] = None
    coaching_centre_id: Optional[str] = None


class PasswordChangeIn(PasswordField):
    """`password` is the new one; current_password proves it is really them."""

    current_password: str = Field(max_length=1024)


class InviteAcceptIn(PasswordField):
    """Accepting an invite is just choosing the password it was issued for."""


class InviteCreateIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    role: Literal["college", "coaching"]
    college_id: Optional[UUID] = None
    coaching_centre_id: Optional[UUID] = None


class InviteOut(BaseModel):
    """Returned once, at creation. `url` carries the only copy of the token."""

    id: UUID
    email: str
    name: str
    role: str
    organisation: str
    expires_at: datetime
    url: str


class InviteDetail(BaseModel):
    """What the set-password page needs to render. No token echoed back."""

    email: str
    name: str
    role: str
    organisation: str
