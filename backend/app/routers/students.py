from fastapi import APIRouter, Depends, HTTPException, Request
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
from app.services.leads import apply_interests
from app.services.email import portal_url, send_email
from app.core.rate_limit import limited
from uuid import UUID
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=StudentResponse, status_code=201)
@limited("5/minute")
async def create_student(
    request: Request,
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

    # A coaching invite code, if supplied, links this student to the issuing
    # centre in the same transaction. Redeeming checks expiry and the use cap
    # with a row lock so two students racing the last use cannot both win.
    if body.invite_code:
        link_result = await db.execute(
            text(
                """
                WITH claimed AS (
                    UPDATE coaching_invites
                    SET uses = uses + 1
                    WHERE code = :code
                      AND (expires_at IS NULL OR expires_at > now())
                      AND uses < max_uses
                    RETURNING coaching_center_id
                )
                INSERT INTO student_coaching_links
                    (id, student_id, coaching_center_id)
                SELECT :link_id, :student_id, coaching_center_id FROM claimed
                """
            ),
            {"code": body.invite_code, "student_id": student_id, "link_id": uuid.uuid4()},
        )
        if link_result.rowcount == 0:
            # Could be unknown, expired, or exhausted. Do not distinguish in the
            # body: the exact reason is not something a stranger needs to probe.
            await db.rollback()
            raise HTTPException(
                status_code=400,
                detail="That invite code is not valid or has already been used up",
            )

        # A bulk-uploaded lead who registers graduates to signed_up, so the
        # institute's cumulative database reflects reality instead of going
        # stale the moment a lead converts.
        await db.execute(
            text(
                """
                UPDATE coaching_students cs
                SET status = 'signed_up', student_id = :student_id
                FROM coaching_invites ci
                WHERE ci.code = :code
                  AND ci.coaching_center_id = cs.coaching_center_id
                  AND cs.email = :email
                """
            ),
            {"code": body.invite_code, "student_id": student_id, "email": email},
        )

        # Whatever the institute shortlisted on the lead's behalf becomes real
        # shortlists now that a student exists to own them. Best effort:
        # unknown or closed courses are skipped, never errors.
        lead = await db.execute(
            text(
                """
                SELECT cs.interests FROM coaching_students cs
                JOIN coaching_invites ci
                  ON ci.coaching_center_id = cs.coaching_center_id
                WHERE ci.code = :code AND cs.email = :email
                """
            ),
            {"code": body.invite_code, "email": email},
        )
        lead_row = lead.fetchone()
        if lead_row is not None and lead_row[0]:
            await apply_interests(db, student_id, lead_row[0])

    await db.commit()

    logger.info(
        "student signed up id=%s stream=%s invite=%s",
        student_id,
        body.stream,
        bool(body.invite_code),
    )
    await send_email(
        email,
        "Your Edee Apply profile is ready",
        f"Hi {body.name.strip()},\n\n"
        "Your profile is created. Shortlist the courses you want and pay "
        f"once for all of them:\n{portal_url('/student/colleges')}",
        purpose="signup",
    )
    return {"id": student_id, "name": body.name.strip(), "stream": body.stream}


@router.get("/me", response_model=StudentProfile)
async def get_me(
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT s.id, s.name, s.email, s.phone, s.stream, s.created_at,
                   cc.name AS coaching_centre_name
            FROM students s
            LEFT JOIN student_coaching_links l ON l.student_id = s.id
            LEFT JOIN coaching_centers cc ON cc.id = l.coaching_center_id
            WHERE s.firebase_uid = :uid
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
                   cc.closing_date,
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


@router.post("/me/applications/{application_id}/withdraw")
async def withdraw_application(
    application_id: UUID,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """
    Lets a student withdraw their own application.

    Only the owner may withdraw, and only from a state a college has not already
    decided. Once accepted or rejected the decision is final; a withdrawn
    application frees the (student, college, course) slot so it is no longer
    held open for someone who has walked away.
    """
    result = await db.execute(
        text(
            """
            UPDATE applications a
            SET status = 'withdrawn', status_note = NULL, updated_at = now()
            FROM students s
            WHERE s.id = a.student_id
              AND s.firebase_uid = :uid
              AND a.id = :aid
              AND a.status IN ('payment_received', 'under_review')
            RETURNING a.id
            """
        ),
        {"uid": user["uid"], "aid": application_id},
    )
    row = result.fetchone()
    if not row:
        # Distinguish "not yours / doesn't exist" from "past the point of
        # withdrawal" so the client can show the right message.
        exists = await db.execute(
            text(
                """
                SELECT a.status FROM applications a
                JOIN students s ON s.id = a.student_id
                WHERE s.firebase_uid = :uid AND a.id = :aid
                """
            ),
            {"uid": user["uid"], "aid": application_id},
        )
        current = exists.fetchone()
        if not current:
            await db.rollback()
            raise HTTPException(status_code=404, detail="Application not found")
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Cannot withdraw an application that is already {current.status}",
        )

    await db.commit()
    return {"status": "withdrawn"}
