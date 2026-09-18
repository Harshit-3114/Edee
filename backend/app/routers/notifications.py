"""
Notification inbox.

Every endpoint scopes to the verified token's UID: a user lists and reads
only their own rows. There is no admin view here — support reads the audit
trail, not people's inboxes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID
from typing import Optional

from app.db.connection import get_db
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["recipient_uid = :uid"]
    params: dict = {"uid": user["uid"], "limit": limit}
    if unread_only:
        conditions.append("read_at IS NULL")
    where = " AND ".join(conditions)

    rows = await db.execute(
        text(
            f"""
            SELECT id, role, type, title, body, link, read_at, created_at
            FROM notifications
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        params,
    )
    unread = await db.execute(
        text(
            "SELECT COUNT(*) FROM notifications "
            "WHERE recipient_uid = :uid AND read_at IS NULL"
        ),
        {"uid": user["uid"]},
    )
    return {
        "notifications": [dict(r._mapping) for r in rows.fetchall()],
        "unread_count": unread.scalar() or 0,
    }


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            UPDATE notifications SET read_at = now()
            WHERE id = :id AND recipient_uid = :uid AND read_at IS NULL
            """
        ),
        {"id": notification_id, "uid": user["uid"]},
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}


@router.post("/read-all")
async def mark_all_read(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text(
            "UPDATE notifications SET read_at = now() "
            "WHERE recipient_uid = :uid AND read_at IS NULL"
        ),
        {"uid": user["uid"]},
    )
    await db.commit()
    return {"status": "ok"}
