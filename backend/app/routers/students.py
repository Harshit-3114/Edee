from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.student import StudentCreate, StudentResponse, StudentProfile
import uuid

router = APIRouter()


@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(
    body: StudentCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    firebase_uid = user["uid"]

    existing = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": firebase_uid}
    )
    row = existing.fetchone()
    if row:
        raise HTTPException(status_code=409, detail="Student already registered")

    student_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO students (id, firebase_uid, name, email, phone, stream)
        VALUES (:id, :firebase_uid, :name, :email, :phone, :stream)
    """), {
        "id": student_id,
        "firebase_uid": firebase_uid,
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "stream": body.stream,
    })
    await db.commit()

    return {"id": student_id, "name": body.name, "stream": body.stream}


@router.get("/me", response_model=StudentProfile)
async def get_me(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id, name, email, phone, stream, created_at FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    return dict(row._mapping)