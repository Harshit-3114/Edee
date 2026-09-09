from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.shortlist import ShortlistAdd, ShortlistResponse
import uuid

router = APIRouter()


async def _get_student_id(user: dict, db: AsyncSession) -> uuid.UUID:
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return row[0]


@router.get("/")
async def get_shortlist(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)
    result = await db.execute(text("""
        SELECT
            s.id AS shortlist_id,
            c.name AS college_name,
            c.city, c.state,
            cc.course_name,
            cc.stream,
            cc.application_fee,
            s.college_id,
            s.course_id
        FROM shortlists s
        JOIN colleges c ON c.id = s.college_id
        JOIN college_courses cc ON cc.id = s.course_id
        WHERE s.student_id = :student_id
        ORDER BY s.created_at DESC
    """), {"student_id": student_id})

    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


@router.post("/", status_code=201)
async def add_to_shortlist(
    body: ShortlistAdd,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)

    try:
        await db.execute(text("""
            INSERT INTO shortlists (id, student_id, college_id, course_id)
            VALUES (:id, :student_id, :college_id, :course_id)
        """), {
            "id": uuid.uuid4(),
            "student_id": student_id,
            "college_id": body.college_id,
            "course_id": body.course_id,
        })
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already shortlisted")

    return {"message": "Added to shortlist"}


@router.delete("/{shortlist_id}", status_code=204)
async def remove_from_shortlist(
    shortlist_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)

    result = await db.execute(text("""
        DELETE FROM shortlists
        WHERE id = :id AND student_id = :student_id
    """), {"id": shortlist_id, "student_id": student_id})
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Shortlist entry not found")