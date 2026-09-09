from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Literal


class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    stream: Literal["UG", "PG"]


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
    created_at: str