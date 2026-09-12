"""
College portal.

Every endpoint takes its college from the verified token via current_college_id.
There is deliberately no college_id path or body parameter anywhere in this
file: the moment one exists, a staff member can read another college's
applicants by editing a URL.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID, uuid4
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

from app.db.connection import get_db
from app.middleware.auth import current_college_id, require_roles
from app.models.college import clean_gallery, dump_gallery, parse_gallery

router = APIRouter()

# Mirrors the CHECK constraint on applications.status. Withdrawal belongs to
# the student, so it is never reachable from here.
NEXT_STATUS = {
    "payment_received": {"under_review"},
    "under_review": {"accepted", "rejected"},
    "accepted": set(),
    "rejected": set(),
    "withdrawn": set(),
}


class CourseCreate(BaseModel):
    course_name: str = Field(min_length=3, max_length=160)
    stream: Literal["UG", "PG"]
    duration_years: Optional[int] = Field(default=None, ge=1, le=7)
    seats: int = Field(ge=1, le=100_000)
    # Paise on the wire, rupees in the column. The `% 100 == 0` guard stops a
    # sub-rupee amount from being silently floored to a different fee on storage.
    application_fee: int = Field(ge=100, le=10_000_000, multiple_of=100)


class CourseUpdate(BaseModel):
    seats: Optional[int] = Field(default=None, ge=1, le=100_000)
    application_fee: Optional[int] = Field(default=None, ge=100, le=10_000_000, multiple_of=100)
    active: Optional[bool] = None


class StatusUpdate(BaseModel):
    status: Literal["under_review", "accepted", "rejected"]
    status_note: Optional[str] = Field(default=None, max_length=280)


class ProfileUpdate(BaseModel):
    location: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=80)
    state: Optional[str] = Field(default=None, max_length=80)
    # The public landing page. A college edits its own marketing copy here;
    # the platform decides when it goes live by toggling `active` in admin.
    landing_hero_image_url: Optional[str] = Field(default=None, max_length=500)
    landing_description: Optional[str] = Field(default=None, max_length=2000)
    landing_gallery_urls: Optional[List[str]] = Field(default=None, max_length=10)

    @field_validator("landing_gallery_urls")
    @classmethod
    def _gallery(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        return clean_gallery(value)


@router.get("/dashboard")
async def dashboard(
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT c.name AS college_name,
                   COALESCE(a.total, 0)         AS applications_total,
                   COALESCE(a.under_review, 0)  AS applications_under_review,
                   COALESCE(a.accepted, 0)      AS seats_filled,
                   COALESCE(s.seats_total, 0)   AS seats_total,
                   COALESCE(p.collected, 0)     AS fees_collected
            FROM colleges c
            LEFT JOIN (
                SELECT college_id,
                       count(*)                                      AS total,
                       count(*) FILTER (WHERE status = 'under_review') AS under_review,
                       count(*) FILTER (WHERE status = 'accepted')     AS accepted
                FROM applications GROUP BY college_id
            ) a ON a.college_id = c.id
            LEFT JOIN (
                SELECT college_id, sum(seats) AS seats_total
                FROM college_courses WHERE active = true GROUP BY college_id
            ) s ON s.college_id = c.id
            LEFT JOIN (
                SELECT oi.college_id, sum(oi.amount) AS collected
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
                GROUP BY oi.college_id
            ) p ON p.college_id = c.id
            WHERE c.id = :cid
            """
        ),
        {"cid": college_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="College not found")
    return dict(row._mapping)


@router.get("/courses")
async def list_courses(
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT id, college_id, course_name, stream, duration_years, seats,
                   application_fee * 100 AS application_fee, active
            FROM college_courses
            WHERE college_id = :cid
            ORDER BY active DESC, course_name
            """
        ),
        {"cid": college_id},
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/courses", status_code=201)
async def create_course(
    body: CourseCreate,
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    course_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO college_courses
                (id, college_id, course_name, stream, duration_years, seats,
                 application_fee, active)
            VALUES (:id, :cid, :name, :stream, :duration, :seats, :fee, true)
            """
        ),
        {
            "id": course_id,
            "cid": college_id,
            "name": body.course_name.strip(),
            "stream": body.stream,
            "duration": body.duration_years,
            "seats": body.seats,
            "fee": body.application_fee // 100,
        },
    )
    await db.commit()
    return {"id": str(course_id)}


@router.get("/courses/{course_id}")
async def get_course(
    course_id: UUID,
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT cc.id, cc.college_id, cc.course_name, cc.stream,
                   cc.duration_years, cc.seats,
                   cc.application_fee * 100 AS application_fee, cc.active,
                   (SELECT count(*) FROM applications a
                     WHERE a.course_id = cc.id)                     AS applications_total,
                   (SELECT count(*) FROM applications a
                     WHERE a.course_id = cc.id AND a.status = 'accepted') AS seats_filled
            FROM college_courses cc
            WHERE cc.id = :course_id AND cc.college_id = :cid
            """
        ),
        {"course_id": course_id, "cid": college_id},
    )
    row = result.fetchone()
    # 404 rather than 403 for another college's course: a 403 would confirm the
    # course exists, which is more than this caller is entitled to know.
    if not row:
        raise HTTPException(status_code=404, detail="Course not found")

    applicants = await db.execute(
        text(
            """
            SELECT a.id, s.name AS student_name, s.stream, cc.course_name,
                   a.status, a.created_at
            FROM applications a
            JOIN students s         ON s.id = a.student_id
            JOIN college_courses cc ON cc.id = a.course_id
            WHERE a.course_id = :course_id AND a.college_id = :cid
            ORDER BY a.created_at DESC
            """
        ),
        {"course_id": course_id, "cid": college_id},
    )
    return {
        **dict(row._mapping),
        "applicants": [dict(r._mapping) for r in applicants.fetchall()],
    }


@router.patch("/courses/{course_id}")
async def update_course(
    course_id: UUID,
    body: CourseUpdate,
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "application_fee" in updates:
        updates["application_fee"] //= 100

    allowed = ("seats", "application_fee", "active")
    fields = [k for k in allowed if k in updates]
    assignments = ", ".join(f"{k} = :{k}" for k in fields)

    result = await db.execute(
        text(
            f"""
            UPDATE college_courses SET {assignments}
            WHERE id = :course_id AND college_id = :cid
            RETURNING id
            """
        ),
        {**{k: updates[k] for k in fields}, "course_id": course_id, "cid": college_id},
    )
    if not result.fetchone():
        await db.rollback()
        raise HTTPException(status_code=404, detail="Course not found")
    await db.commit()
    return {"status": "updated"}


@router.get("/applications")
async def list_applications(
    status: Optional[
        Literal["payment_received", "under_review", "accepted", "rejected", "withdrawn"]
    ] = Query(None),
    course_id: Optional[UUID] = Query(None),
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["a.college_id = :cid"]
    params: dict = {"cid": college_id}
    if status:
        conditions.append("a.status = :status")
        params["status"] = status
    if course_id:
        conditions.append("a.course_id = :course_id")
        params["course_id"] = course_id

    result = await db.execute(
        text(
            f"""
            SELECT a.id, s.name AS student_name, s.stream, cc.course_name,
                   a.status, a.created_at
            FROM applications a
            JOIN students s         ON s.id = a.student_id
            JOIN college_courses cc ON cc.id = a.course_id
            WHERE {" AND ".join(conditions)}
            ORDER BY a.created_at DESC
            LIMIT 500
            """
        ),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/applications/{application_id}")
async def get_application(
    application_id: UUID,
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT a.id,
                   s.name  AS student_name,
                   s.email AS student_email,
                   s.phone AS student_phone,
                   s.stream,
                   a.course_id,
                   cc.course_name,
                   a.status,
                   a.status_note,
                   COALESCE(oi.amount, cc.application_fee * 100) AS amount,
                   a.created_at,
                   a.updated_at
            FROM applications a
            JOIN students s         ON s.id = a.student_id
            JOIN college_courses cc ON cc.id = a.course_id
            LEFT JOIN order_items oi ON oi.course_id = a.course_id
                                    AND oi.college_id = a.college_id
            WHERE a.id = :aid AND a.college_id = :cid
            """
        ),
        {"aid": application_id, "cid": college_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    return dict(row._mapping)


@router.patch("/applications/{application_id}")
async def update_application(
    application_id: UUID,
    body: StatusUpdate,
    user: dict = Depends(require_roles("college")),
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    current = await db.execute(
        text("SELECT status FROM applications WHERE id = :aid AND college_id = :cid"),
        {"aid": application_id, "cid": college_id},
    )
    row = current.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    # The transition table is enforced here, not just offered in the UI. A
    # rejected application must not become accepted because someone replayed
    # an old request.
    if body.status not in NEXT_STATUS[row.status]:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot move an application from {row.status} to {body.status}",
        )

    await db.execute(
        text(
            """
            UPDATE applications
            SET status = :status,
                status_note = :note,
                status_changed_by = NULL,
                updated_at = now()
            WHERE id = :aid AND college_id = :cid
            """
        ),
        {
            "status": body.status,
            "note": body.status_note,
            "aid": application_id,
            "cid": college_id,
        },
    )
    await db.execute(
        text(
            """
            INSERT INTO audit_events
                (id, actor_role, action, entity_type, entity_id)
            VALUES (:id, 'college', :action, 'application', :entity)
            """
        ),
        {
            "id": uuid4(),
            "action": f"application.{body.status}",
            "entity": application_id,
        },
    )
    await db.commit()
    return {"status": body.status}


@router.get("/profile")
async def get_profile(
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            "SELECT name, location, city, state, type, "
            "landing_hero_image_url, landing_description, landing_gallery_urls "
            "FROM colleges WHERE id = :cid"
        ),
        {"cid": college_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="College not found")
    data = dict(row._mapping)
    data["landing_gallery_urls"] = parse_gallery(data.get("landing_gallery_urls"))
    return data


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdate,
    college_id: UUID = Depends(current_college_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Name and type are absent on purpose: those are the platform's record of who
    this college is, and only an admin changes them.
    """
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    allowed = (
        "location",
        "city",
        "state",
        "landing_hero_image_url",
        "landing_description",
        "landing_gallery_urls",
    )
    fields = [k for k in allowed if k in updates]
    if "landing_gallery_urls" in updates:
        updates["landing_gallery_urls"] = dump_gallery(updates["landing_gallery_urls"])
    assignments = ", ".join(f"{k} = :{k}" for k in fields)

    await db.execute(
        text(f"UPDATE colleges SET {assignments} WHERE id = :cid"),
        {**{k: updates[k] for k in fields}, "cid": college_id},
    )
    await db.commit()
    return {"status": "updated"}
