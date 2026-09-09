from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user, require_roles
from app.models.student import (
    StudentCreate,
    StudentResponse,
    StudentProfile,
    StudentUpdate,
)
from app.services.firebase import assign_role
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(
    body: StudentCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Completes signup for someone who has authenticated but has no role yet.

    Guarded by get_current_user rather than require_roles on purpose: this is
    the endpoint that grants the student role, so demanding it here would make
    signup impossible.
    """
    firebase_uid = user["uid"]

    # An account that already carries a staff role must not mint a student
    # profile on top of it. Otherwise a college admin gives themselves a second
    # identity and walks around inside the student portal.
    if user.get("role") and user.get("role") != "student":
        raise HTTPException(
            status_code=403, detail="This account already belongs to a staff portal"
        )

    existing = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": firebase_uid},
    )
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="Student already registered")

    # Identity comes from the verified token wherever the token carries it.
    # Trusting the request body lets anyone register under someone else's
    # address, which then receives that person's application mail.
    verified_email = user.get("email")
    email = (verified_email or body.email).lower().strip()

    token_phone = user.get("phone_number")  # E.164 when signed in by OTP
    phone = (token_phone[-10:] if token_phone else body.phone).strip()

    # Checked here for a clean 409; the unique indexes are what guarantee it.
    clash = await db.execute(
        text("SELECT 1 FROM students WHERE email = :email OR phone = :phone LIMIT 1"),
        {"email": email, "phone": phone},
    )
    if clash.fetchone():
        raise HTTPException(
            status_code=409, detail="That email or phone number is already registered"
        )

    student_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO students (id, firebase_uid, name, email, phone, stream)
            VALUES (:id, :firebase_uid, :name, :email, :phone, :stream)
            """
        ),
        {
            "id": student_id,
            "firebase_uid": firebase_uid,
            "name": body.name.strip(),
            "email": email,
            "phone": phone,
            "stream": body.stream,
        },
    )

    # Claim and row are written together. If the claim fails the row is rolled
    # back, rather than leaving a student who can never reach their portal.
    assign_role(firebase_uid, "student")
    await db.commit()

    return {"id": student_id, "name": body.name.strip(), "stream": body.stream}


@router.get("/me", response_model=StudentProfile)
async def get_me(
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT id, name, email, phone, stream, created_at
            FROM students WHERE firebase_uid = :uid
            """
        ),
        {"uid": user["uid"]},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    return dict(row._mapping)


@router.patch("/me", response_model=StudentProfile)
async def update_me(
    body: StudentUpdate,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """
    Name, phone and stream only.

    Email is not editable: it is the verified identity the account signed in
    with, and rewriting it would undo the check in create_student.
    """
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    if "phone" in updates:
        clash = await db.execute(
            text(
                "SELECT 1 FROM students "
                "WHERE phone = :phone AND firebase_uid <> :uid LIMIT 1"
            ),
            {"phone": updates["phone"], "uid": user["uid"]},
        )
        if clash.fetchone():
            raise HTTPException(
                status_code=409, detail="That phone number is already registered"
            )

    # Column names are taken from a fixed allow-list, never from raw input, so
    # the interpolation below cannot be steered by the request.
    allowed = ("name", "phone", "stream")
    fields = [k for k in allowed if k in updates]
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    assignments = ", ".join(f"{k} = :{k}" for k in fields)

    result = await db.execute(
        text(
            f"""
            UPDATE students SET {assignments}
            WHERE firebase_uid = :uid
            RETURNING id, name, email, phone, stream, created_at
            """
        ),
        {**{k: updates[k] for k in fields}, "uid": user["uid"]},
    )
    row = result.fetchone()
    if not row:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Student not found")

    await db.commit()
    return dict(row._mapping)


@router.get("/me/applications")
async def my_applications(
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """What the student dashboard renders. Amounts in paise, as everywhere."""
    result = await db.execute(
        text(
            """
            SELECT a.id,
                   a.college_id,
                   a.course_id,
                   c.name          AS college_name,
                   cc.course_name,
                   c.city,
                   a.status,
                   a.status_note,
                   COALESCE(oi.amount, cc.application_fee * 100) AS amount,
                   a.created_at,
                   a.updated_at
            FROM applications a
            JOIN students s         ON s.id = a.student_id
            JOIN colleges c         ON c.id = a.college_id
            JOIN college_courses cc ON cc.id = a.course_id
            LEFT JOIN order_items oi
                   ON oi.course_id = a.course_id
                  AND oi.order_id IN (SELECT o.id FROM orders o
                                      WHERE o.student_id = a.student_id)
            WHERE s.firebase_uid = :uid
            ORDER BY a.created_at DESC
            """
        ),
        {"uid": user["uid"]},
    )
    return [dict(row._mapping) for row in result.fetchall()]
