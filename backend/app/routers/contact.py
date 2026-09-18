"""
Public contact form.

Written by anyone, rate-limited against spam. Messages are only ever read
by platform admins (see GET /admin/contact-messages).
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr, Field
from uuid import uuid4
import logging

from app.db.connection import get_db
from app.core.rate_limit import limited

router = APIRouter()

logger = logging.getLogger(__name__)


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    purpose: str = Field(min_length=2, max_length=40)
    message: str = Field(min_length=10, max_length=5000)


@router.post("/", status_code=201)
@limited("10/minute")
async def create_message(
    request: Request,
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
):
    message_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO contact_messages (id, name, email, purpose, message)
            VALUES (:id, :name, :email, :purpose, :message)
            """
        ),
        {
            "id": message_id,
            "name": body.name.strip(),
            "email": body.email.lower().strip(),
            "purpose": body.purpose.strip(),
            "message": body.message.strip(),
        },
    )
    await db.commit()
    logger.info("contact message received id=%s purpose=%s", message_id, body.purpose)
    return {"id": str(message_id)}
