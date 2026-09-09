"""
Coaching portal.

Read-only over students, by design. A centre can watch how its cohort is doing;
it cannot edit a profile, touch a shortlist, or pay on anyone's behalf. There is
no write endpoint here that reaches a students row, and adding one is a product
decision rather than a missing feature.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID, uuid4
from typing import Literal, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import secrets

from app.db.connection import get_db
from app.middleware.auth import current_coaching_centre_id

router = APIRouter()

STAGE_SQL = """
    CASE
        WHEN app.cnt > 0 AND app.accepted > 0 THEN 'accepted'
        WHEN app.cnt > 0                      THEN 'paid'
        WHEN sl.cnt > 0                       THEN 'shortlisted'
        ELSE 'signed_up'
    END
"""


class InviteCreate(BaseModel):
    max_uses: int = Field(default=100, ge=1, le=10_000)
    expires_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    contact_email: Optional[str] = Field(default=None, max_length=200)
    contact_phone: Optional[str] = Field(default=None, max_length=20)


@router.get("/dashboard")
async def dashboard(
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT cc.name AS centre_name,
                   count(DISTINCT l.student_id) AS signed_up,
                   count(DISTINCT sl.student_id) AS shortlisted,
                   count(DISTINCT a.student_id)  AS paid,
                   count(DISTINCT a.student_id) FILTER (WHERE a.status = 'accepted')
                       AS accepted
            FROM coaching_centers cc
            LEFT JOIN student_coaching_links l ON l.coaching_center_id = cc.id
            LEFT JOIN shortlists sl            ON sl.student_id = l.student_id
            LEFT JOIN applications a           ON a.student_id = l.student_id
            WHERE cc.id = :cid
            GROUP BY cc.name
            """
        ),
        {"cid": centre_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Coaching centre not found")
    return dict(row._mapping)


@router.get("/students")
async def list_students(
    stage: Optional[
        Literal["signed_up", "shortlisted", "paid", "accepted"]
    ] = Query(None),
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["l.coaching_center_id = :cid"]
    params: dict = {"cid": centre_id, "limit": limit, "offset": offset}

    if search:
        conditions.append("(s.name ILIKE :search OR s.phone ILIKE :search)")
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{escaped}%"

    having = ""
    if stage:
        having = f"HAVING {STAGE_SQL} = :stage"
        params["stage"] = stage

    result = await db.execute(
        text(
            f"""
            SELECT s.id, s.name, s.phone, s.stream,
                   COALESCE(sl.cnt, 0)  AS shortlist_count,
                   COALESCE(app.cnt, 0) AS application_count,
                   l.linked_at          AS joined_at,
                   {STAGE_SQL}          AS stage
            FROM student_coaching_links l
            JOIN students s ON s.id = l.student_id
            LEFT JOIN (SELECT student_id, count(*) cnt FROM shortlists
                       GROUP BY student_id) sl ON sl.student_id = s.id
            LEFT JOIN (SELECT student_id, count(*) cnt,
                              count(*) FILTER (WHERE status = 'accepted') accepted
                       FROM applications GROUP BY student_id) app
                   ON app.student_id = s.id
            WHERE {" AND ".join(conditions)}
            GROUP BY s.id, s.name, s.phone, s.stream, sl.cnt, app.cnt,
                     app.accepted, l.linked_at
            {having}
            ORDER BY l.linked_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/students/{student_id}")
async def get_student(
    student_id: UUID,
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    """
    404 rather than 403 for a student who is not linked to this centre.

    A 403 would confirm the student exists on the platform, which lets a centre
    probe for people it has no relationship with.
    """
    result = await db.execute(
        text(
            f"""
            SELECT s.id, s.name, s.email, s.phone, s.stream,
                   COALESCE(sl.cnt, 0)  AS shortlist_count,
                   COALESCE(app.cnt, 0) AS application_count,
                   l.linked_at          AS joined_at,
                   {STAGE_SQL}          AS stage
            FROM student_coaching_links l
            JOIN students s ON s.id = l.student_id
            LEFT JOIN (SELECT student_id, count(*) cnt FROM shortlists
                       GROUP BY student_id) sl ON sl.student_id = s.id
            LEFT JOIN (SELECT student_id, count(*) cnt,
                              count(*) FILTER (WHERE status = 'accepted') accepted
                       FROM applications GROUP BY student_id) app
                   ON app.student_id = s.id
            WHERE l.coaching_center_id = :cid AND s.id = :sid
            GROUP BY s.id, s.name, s.email, s.phone, s.stream, sl.cnt, app.cnt,
                     app.accepted, l.linked_at
            """
        ),
        {"cid": centre_id, "sid": student_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")

    shortlist = await db.execute(
        text(
            """
            SELECT sl.id, sl.college_id, sl.course_id, c.name AS college_name,
                   cc.course_name, c.city, c.state, cc.stream,
                   cc.application_fee * 100 AS application_fee, sl.created_at
            FROM shortlists sl
            JOIN colleges c         ON c.id = sl.college_id
            JOIN college_courses cc ON cc.id = sl.course_id
            WHERE sl.student_id = :sid
            ORDER BY sl.created_at DESC
            """
        ),
        {"sid": student_id},
    )
    applications = await db.execute(
        text(
            """
            SELECT a.id, a.college_id, a.course_id, c.name AS college_name,
                   cc.course_name, c.city, a.status, a.status_note,
                   COALESCE(oi.amount, cc.application_fee * 100) AS amount,
                   a.created_at, a.updated_at
            FROM applications a
            JOIN colleges c         ON c.id = a.college_id
            JOIN college_courses cc ON cc.id = a.course_id
            LEFT JOIN order_items oi ON oi.course_id = a.course_id
                                    AND oi.college_id = a.college_id
            WHERE a.student_id = :sid
            ORDER BY a.created_at DESC
            """
        ),
        {"sid": student_id},
    )
    return {
        **dict(row._mapping),
        "shortlist": [dict(r._mapping) for r in shortlist.fetchall()],
        "applications": [dict(r._mapping) for r in applications.fetchall()],
    }


@router.get("/invites")
async def list_invites(
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT id, code, max_uses, uses, expires_at, created_at
            FROM coaching_invites
            WHERE coaching_center_id = :cid
            ORDER BY created_at DESC
            """
        ),
        {"cid": centre_id},
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/invites", status_code=201)
async def create_invite(
    body: InviteCreate,
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    if body.expires_at and body.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Expiry must be in the future")

    # secrets, not random: an invite code is a bearer credential that attaches a
    # student to a centre, and a guessable one lets anyone claim someone's cohort.
    code = secrets.token_urlsafe(9).upper().replace("_", "").replace("-", "")[:10]
    invite_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO coaching_invites
                (id, coaching_center_id, code, max_uses, expires_at)
            VALUES (:id, :cid, :code, :max_uses, :expires_at)
            """
        ),
        {
            "id": invite_id,
            "cid": centre_id,
            "code": code,
            "max_uses": body.max_uses,
            "expires_at": body.expires_at,
        },
    )
    await db.commit()
    return {"id": str(invite_id), "code": code}


@router.get("/profile")
async def get_profile(
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT cc.name, cc.city, cc.state,
                   COALESCE(a.email, '') AS contact_email,
                   ''                    AS contact_phone
            FROM coaching_centers cc
            LEFT JOIN coaching_center_admins a
                   ON a.coaching_center_id = cc.id AND a.active = true
            WHERE cc.id = :cid
            LIMIT 1
            """
        ),
        {"cid": centre_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Coaching centre not found")
    return dict(row._mapping)


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdate,
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    if body.contact_email:
        await db.execute(
            text(
                """
                UPDATE coaching_center_admins SET email = :email
                WHERE coaching_center_id = :cid AND active = true
                """
            ),
            {"email": body.contact_email.lower().strip(), "cid": centre_id},
        )
        await db.commit()
    return {"status": "updated"}
