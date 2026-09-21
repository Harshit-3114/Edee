"""
Coaching portal.

Read-only over students, by design. A centre can watch how its cohort is doing;
it cannot edit a profile, touch a shortlist, or pay on anyone's behalf. There is
no write endpoint here that reaches a students row, and adding one is a product
decision rather than a missing feature.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID, uuid4
from typing import Literal, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import logging
import re
import secrets

from app.db.connection import get_db
from app.middleware.auth import current_coaching_centre_id
from app.core.rate_limit import limited
from app.services.leads import (
    MAX_INTERESTS_CHARS,
    SHORTLISTED_HEADER,
    build_template_xlsx,
    read_rows,
)
from app.services.email import portal_url, send_email

router = APIRouter()

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[6-9]\d{9}$")

# A thousand leads is a large genuine batch; larger than that is either a
# database dump wearing a filename or a mistake. Both deserve a conversation
# before they land in one request.
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_UPLOAD_ROWS = 1000
MAX_ERRORS_SHOWN = 20

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
                   cc.amount_per_lead,
                   cc.credit_paise,
                   count(DISTINCT l.student_id) AS signed_up,
                   count(DISTINCT sl.student_id) AS shortlisted,
                   count(DISTINCT a.student_id)  AS paid,
                   count(DISTINCT a.student_id) FILTER (WHERE a.status = 'accepted')
                       AS accepted,
                   count(DISTINCT cs.id) AS total_leads
            FROM coaching_centers cc
            LEFT JOIN student_coaching_links l ON l.coaching_center_id = cc.id
            LEFT JOIN shortlists sl            ON sl.student_id = l.student_id
            LEFT JOIN applications a           ON a.student_id = l.student_id
            LEFT JOIN coaching_students cs     ON cs.coaching_center_id = cc.id
            WHERE cc.id = :cid
            GROUP BY cc.name, cc.amount_per_lead, cc.credit_paise
            """
        ),
        {"cid": centre_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Coaching centre not found")
    data = dict(row._mapping)
    # Derived, never stored: the dashboard and the admin panel read the same
    # two columns, so they cannot disagree about what is owed.
    data["outstanding_amount"] = max(
        data["total_leads"] * data["amount_per_lead"] - data["credit_paise"], 0
    )
    return data


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
                   cc.application_fee * 100 AS application_fee,
                   cc.application_start_date, cc.intake_info, cc.closing_date,
                   sl.created_at
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


@router.get("/uploads/template")
async def upload_template():
    """
    The Excel file institutes fill in: headers, widths, and example rows, so
    the shape - including the shortlisted column - is visible in the file
    itself rather than only in documentation nobody opens.
    """
    return Response(
        content=build_template_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=student-upload-template.xlsx"
        },
    )


@router.post("/uploads", status_code=201)
@limited("10/minute")
async def upload_students(
    request: Request,
    file: UploadFile = File(...),
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk-add leads from a CSV or Excel file. Cumulative by design: every file
    appends, and email is unique per centre, so re-sending a file bumps the
    duplicate counter instead of doubling the database.

    An email already registered on the platform (a signed-up student) is also
    a duplicate: the institute cannot claim someone else's account as a lead.

    The optional `shortlisted` column ("College :: Course; ...") is stored
    verbatim and resolved into real shortlists when the lead registers.
    """
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Keep uploads under 2 MB.")

    rows = read_rows(file.filename or "upload.csv", raw)
    if len(rows) > MAX_UPLOAD_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"At most {MAX_UPLOAD_ROWS} rows per upload. Split the file and send it in parts.",
        )

    emails = []
    for _, row in rows:
        email = (row.get("email") or "").strip().lower()
        if email:
            emails.append(email)

    taken = set()
    if emails:
        existing = await db.execute(
            text(
                """
                SELECT email FROM coaching_students
                WHERE coaching_center_id = :cid AND email = ANY(:emails)
                UNION
                SELECT email FROM students WHERE email = ANY(:emails)
                """
            ),
            {"cid": centre_id, "emails": emails},
        )
        taken = {row[0] for row in existing.fetchall()}

    created, duplicates, errors = 0, 0, []
    seen_in_file: set = set()
    valid: list = []
    for lineno, row in rows:  # read_rows already numbers lines from the header
        name = (row.get("name") or "").strip()
        email = (row.get("email") or "").strip().lower()
        phone = re.sub(r"\D", "", row.get("phone") or "")
        stream = (row.get("stream") or "").strip().upper()
        interests = (row.get(SHORTLISTED_HEADER) or "").strip() or None
        if interests and len(interests) > MAX_INTERESTS_CHARS:
            interests = interests[:MAX_INTERESTS_CHARS]

        reason = None
        if len(name) < 2:
            reason = "name is too short"
        elif not EMAIL_RE.match(email):
            reason = "email is not valid"
        elif phone and not PHONE_RE.match(phone):
            reason = "phone must be a 10-digit Indian mobile number"
        elif stream and stream not in ("UG", "PG"):
            reason = "stream must be UG or PG"
        elif email in seen_in_file or email in taken:
            duplicates += 1
            seen_in_file.add(email)
            continue

        if reason is not None:
            errors.append({"row": lineno, "reason": reason})
            continue

        seen_in_file.add(email)
        valid.append(
            {
                "id": uuid4(),
                "name": name,
                "email": email,
                "phone": phone or None,
                "stream": stream or None,
                "interests": interests,
            }
        )
        created += 1

    upload_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO coaching_uploads
                (id, coaching_center_id, filename, status,
                 records_total, records_created, records_duplicate, records_error)
            VALUES (:id, :cid, :filename, 'processed',
                    :total, :created, :duplicates, :errors)
            """
        ),
        {
            "id": upload_id,
            "cid": centre_id,
            "filename": (file.filename or "upload.csv")[:200],
            "total": len(rows),
            "created": created,
            "duplicates": duplicates,
            "errors": len(errors),
        },
    )
    for item in valid:
        await db.execute(
            text(
                """
                INSERT INTO coaching_students
                    (id, upload_id, coaching_center_id, name, email, phone,
                     stream, interests)
                VALUES (:id, :upload_id, :cid, :name, :email, :phone,
                        :stream, :interests)
                """
            ),
            {"upload_id": upload_id, "cid": centre_id, **item},
        )
    await db.commit()

    logger.info(
        "upload processed centre=%s file=%s total=%d created=%d duplicates=%d errors=%d",
        centre_id,
        file.filename,
        len(rows),
        created,
        duplicates,
        len(errors),
    )
    contact = await db.execute(
        text(
            """
            SELECT a.email FROM coaching_center_admins a
            WHERE a.coaching_center_id = :cid AND a.active = true
            LIMIT 1
            """
        ),
        {"cid": centre_id},
    )
    contact_row = contact.fetchone()
    if contact_row is not None and contact_row[0]:
        await send_email(
            contact_row[0],
            f"Upload received: {created} leads added",
            f"Your file {file.filename or 'upload'} held {len(rows)} rows: "
            f"{created} added, {duplicates} duplicates, {len(errors)} errors.\n\n"
            "Every upload adds to your cumulative database and to your "
            "outstanding amount:\n"
            f"{portal_url('/coaching/dashboard')}",
            purpose="upload-receipt",
        )
    return {
        "upload_id": str(upload_id),
        "total": len(rows),
        "created": created,
        "duplicates": duplicates,
        "errors": errors[:MAX_ERRORS_SHOWN],
        "error_count": len(errors),
    }


@router.get("/uploads")
async def list_uploads(
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    """Every file this centre ever sent. Cumulative, never session-scoped."""
    result = await db.execute(
        text(
            """
            SELECT id, filename, status, records_total, records_created,
                   records_duplicate, records_error, created_at
            FROM coaching_uploads
            WHERE coaching_center_id = :cid
            ORDER BY created_at DESC
            """
        ),
        {"cid": centre_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/uploaded-students")
async def list_uploaded_students(
    status: Optional[Literal["uploaded", "signed_up"]] = Query(None),
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    centre_id: UUID = Depends(current_coaching_centre_id),
    db: AsyncSession = Depends(get_db),
):
    """
    The cumulative lead database: every valid row from every upload, whatever
    the session. Distinct from GET /students, which only shows leads who went
    on to register with an invite code.
    """
    conditions = ["cs.coaching_center_id = :cid"]
    params: dict = {"cid": centre_id, "limit": limit, "offset": offset}
    if status:
        conditions.append("cs.status = :status")
        params["status"] = status
    if search:
        conditions.append("(cs.name ILIKE :search OR cs.email ILIKE :search)")
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{escaped}%"

    result = await db.execute(
        text(
            f"""
            SELECT cs.id, cs.name, cs.email, cs.phone, cs.stream, cs.status,
                   cs.interests, cs.created_at, u.filename AS uploaded_via
            FROM coaching_students cs
            LEFT JOIN coaching_uploads u ON u.id = cs.upload_id
            WHERE {" AND ".join(conditions)}
            ORDER BY cs.created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    )
    return [dict(row._mapping) for row in result.fetchall()]


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
    logger.info("invite created centre=%s max_uses=%d", centre_id, body.max_uses)
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
