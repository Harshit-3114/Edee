from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import require_roles
from app.models.shortlist import ShortlistAdd
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_SHORTLIST = 50


async def _get_student_id(user: dict, db: AsyncSession) -> uuid.UUID:
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return row[0]


@router.get("/")
async def get_shortlist(
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """Fees in paise, matching the rest of the API."""
    student_id = await _get_student_id(user, db)
    result = await db.execute(
        text(
            """
            SELECT s.id,
                   s.college_id,
                   s.course_id,
                   c.name AS college_name,
                   c.city,
                   c.state,
                   cc.course_name,
                   cc.stream,
                   cc.application_fee * 100 AS application_fee,
                   s.created_at
            FROM shortlists s
            JOIN colleges c         ON c.id = s.college_id
            JOIN college_courses cc ON cc.id = s.course_id
            WHERE s.student_id = :student_id
            ORDER BY s.created_at DESC
            """
        ),
        {"student_id": student_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.post("/", status_code=201)
async def add_to_shortlist(
    body: ShortlistAdd,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)

    # The course must belong to the college being claimed, and both must be
    # open. Without this a client can pair any course id with any college id
    # and create a shortlist row that no page can render and no order can price.
    pair = await db.execute(
        text(
            """
            SELECT 1
            FROM college_courses cc
            JOIN colleges c ON c.id = cc.college_id
            WHERE cc.id = :course_id
              AND cc.college_id = :college_id
              AND cc.active = true
              AND c.active = true
            """
        ),
        {"course_id": body.course_id, "college_id": body.college_id},
    )
    if not pair.fetchone():
        raise HTTPException(
            status_code=404, detail="That course is not open at that college"
        )

    # Serialise the count-and-insert with an advisory lock per student so two
    # concurrent adds cannot both pass the < MAX_SHORTLIST check and over-fill.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(CAST(:sid AS TEXT)))"),
        {"sid": str(student_id)},
    )

    count = await db.execute(
        text("SELECT count(*) FROM shortlists WHERE student_id = :sid"),
        {"sid": student_id},
    )
    if count.scalar_one() >= MAX_SHORTLIST:
        raise HTTPException(
            status_code=409,
            detail=f"A shortlist holds at most {MAX_SHORTLIST} courses",
        )

    # Let the unique constraint decide, rather than checking first and racing.
    result = await db.execute(
        text(
            """
            INSERT INTO shortlists (id, student_id, college_id, course_id)
            VALUES (:id, :student_id, :college_id, :course_id)
            ON CONFLICT (student_id, college_id, course_id) DO NOTHING
            RETURNING id
            """
        ),
        {
            "id": uuid.uuid4(),
            "student_id": student_id,
            "college_id": body.college_id,
            "course_id": body.course_id,
        },
    )
    row = result.fetchone()
    await db.commit()

    if not row:
        raise HTTPException(status_code=409, detail="Already shortlisted")

    return {"id": str(row[0]), "message": "Added to shortlist"}


@router.delete("/{shortlist_id}", status_code=204)
async def remove_from_shortlist(
    shortlist_id: uuid.UUID,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)

    # The student_id in the WHERE clause is the ownership check. Deleting by id
    # alone would let anyone remove any student's shortlist entry.
    result = await db.execute(
        text("DELETE FROM shortlists WHERE id = :id AND student_id = :student_id"),
        {"id": shortlist_id, "student_id": student_id},
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Shortlist entry not found")
