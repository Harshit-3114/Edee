from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional
import re

PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def _clean_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)[-10:]
    if not PHONE_RE.match(digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return digits


class StudentCreate(BaseModel):
    # Bounded so a request body cannot carry a megabyte of "name" into the
    # database and out again onto every college's applicant list.
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str
    stream: Literal["UG", "PG"]
    # Optional coaching invite code, which links this student to a centre.
    invite_code: Optional[str] = Field(default=None, max_length=20)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return _clean_phone(value)

    @field_validator("invite_code")
    @classmethod
    def _invite(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().upper()
        if not cleaned:
            return None
        return cleaned

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class StudentUpdate(BaseModel):
    """Email is absent on purpose: it is the verified sign-in identity."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = None
    stream: Optional[Literal["UG", "PG"]] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: Optional[str]) -> Optional[str]:
        return _clean_phone(value) if value is not None else None

    @field_validator("name")
    @classmethod
    def _name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class StudentResponse(BaseModel):
    id: UUID
    name: str
    stream: str


class StudentProfile(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    phone: str
    stream: str
    # datetime, not str: the column is TIMESTAMPTZ, and typing it as str made
    # FastAPI fail serialisation on every profile read.
    created_at: datetime
