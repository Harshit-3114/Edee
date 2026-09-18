"""
Notification writer.

One row per event per recipient. Callers pass everything the row needs;
ownership stays a WHERE clause on recipient_uid in the router, never logic
here. Writes join the caller's transaction — a rolled-back status change
rolls its notification back too.
"""
from typing import Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def notify(
    db: AsyncSession,
    recipient_uid: str,
    role: str,
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO notifications
                (id, recipient_uid, role, type, title, body, link)
            VALUES (:id, :uid, :role, :type, :title, :body, :link)
            """
        ),
        {
            "id": uuid4(),
            "uid": recipient_uid,
            "role": role,
            "type": type,
            "title": title,
            "body": body,
            "link": link,
        },
    )
