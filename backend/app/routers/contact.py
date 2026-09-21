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
from app.core.config import settings
from app.core.rate_limit import limited
from app.services.email import portal_url, send_email

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
    await send_email(
        body.email.lower().strip(),
        "We received your message",
        f"Hi {body.name.strip()},\n\n"
        "Thanks for writing to Edee Apply. Our team reads every message and "
        "will get back to you on this address.",
        purpose="contact-ack",
    )
    if settings.ADMIN_EMAIL:
        await send_email(
            settings.ADMIN_EMAIL,
            f"New contact message: {body.purpose.strip()}",
            f"From: {body.name.strip()} <{body.email.lower().strip()}>\n"
            f"Purpose: {body.purpose.strip()}\n\n"
            f"{body.message.strip()}\n\n"
            f"Read it in the inbox:\n{portal_url('/admin/inbox')}",
            purpose="contact-alert",
        )
    return {"id": str(message_id)}
