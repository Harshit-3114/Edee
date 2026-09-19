"""
Admin portal.

Unscoped by design: an admin sees every college, centre and student. That makes
this the highest-value router in the codebase, so every write appends to
audit_events and role assignment lives here and nowhere else.
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from uuid import UUID, uuid4
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import logging

from app.db.connection import get_db
from app.middleware.auth import require_roles
from app.services import health as health_checks
from app.services.firebase import assign_role, revoke_access
from app.services.email import portal_url, send_email
from app.core.slug import is_valid_slug, make_slug
from app.models.college import clean_gallery, dump_gallery, parse_gallery
from app.routers.college_portal import CourseCreate, CourseUpdate

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_roles("admin"))])

# College marks live here, served by the /uploads static mount in main.py.
# Filenames are server-built ({college_id}.{ext}), never user-supplied, so no
# crafted filename can escape the directory.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
LOGO_DIR = UPLOAD_DIR / "logos"
LOGO_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_LOGO_BYTES = 2 * 1024 * 1024


class CollegeCreate(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    location: str = Field(max_length=300)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=1, max_length=80)
    type: Literal["private", "government", "deemed"]
    # Optional slug override. Without it the slug is generated from the name;
    # either way it must be unique, which the database enforces.
    slug: Optional[str] = Field(default=None, max_length=120)
    landing_hero_image_url: Optional[str] = Field(default=None, max_length=500)
    landing_description: Optional[str] = Field(default=None, max_length=2000)
    landing_gallery_urls: Optional[List[str]] = Field(default=None, max_length=10)

    @field_validator("slug")
    @classmethod
    def _slug(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if not is_valid_slug(cleaned):
            raise ValueError("Slug may only contain lowercase letters, digits and hyphens")
        return cleaned

    @field_validator("landing_gallery_urls")
    @classmethod
    def _gallery(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        return clean_gallery(value)


class CollegeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=200)
    location: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, min_length=1, max_length=80)
    state: Optional[str] = Field(default=None, min_length=1, max_length=80)
    type: Optional[Literal["private", "government", "deemed"]] = None
    active: Optional[bool] = None
    landing_hero_image_url: Optional[str] = Field(default=None, max_length=500)
    landing_description: Optional[str] = Field(default=None, max_length=2000)
    landing_gallery_urls: Optional[List[str]] = Field(default=None, max_length=10)
    # Free-text admission rounds, shown on the public landing page.
    application_phases: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("landing_gallery_urls")
    @classmethod
    def _gallery(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        return clean_gallery(value)

    @field_validator("application_phases")
    @classmethod
    def _phases(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CentreCreate(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=1, max_length=80)
    contact_email: EmailStr
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    # Paise charged per submitted lead. Zero means the commercial terms are
    # not set yet, and the dashboard shows no outstanding amount.
    amount_per_lead: int = Field(default=0, ge=0, le=10_000_000)


class CentreUpdate(BaseModel):
    active: Optional[bool] = None
    amount_per_lead: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    # Payments and waivers the platform extends. Subtracted from the derived
    # outstanding, so credit stays visible instead of silently shrinking leads.
    credit_paise: Optional[int] = Field(default=None, ge=0, le=1_000_000_000)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # "student" is absent: students sign themselves up, and minting one here
    # would create an account with no verified phone or email behind it.
    role: Literal["college", "coaching", "admin"]
    college_id: Optional[UUID] = None
    coaching_centre_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    active: Optional[bool] = None


async def _audit(db: AsyncSession, action: str, entity_type: str, entity_id) -> None:
    await db.execute(
        text(
            """
            INSERT INTO audit_events
                (id, actor_role, action, entity_type, entity_id)
            VALUES (:id, 'admin', :action, :etype, :eid)
            """
        ),
        {"id": uuid4(), "action": action, "etype": entity_type, "eid": entity_id},
    )


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT (SELECT count(*) FROM students)          AS students,
                   (SELECT count(*) FROM colleges)          AS colleges,
                   (SELECT count(*) FROM coaching_centers)  AS coaching_centres,
                   (SELECT count(*) FROM applications)      AS applications,
                   (SELECT COALESCE(sum(amount), 0) FROM payments
                     WHERE status = 'captured')             AS revenue
            """
        )
    )
    return dict(result.fetchone()._mapping)


@router.get("/system", response_model=health_checks.SystemStatus)
async def system_status():
    """
    Live dependency checks for the admin status page: API itself, database,
    Firebase Auth, and Razorpay.

    Deliberately outside get_db: if the database is the thing that is down,
    the endpoint must still answer "database: down" instead of 500ing.
    """
    services = [
        health_checks.check_api(),
        await health_checks.check_database(),
        health_checks.check_firebase(),
        health_checks.check_razorpay(),
    ]
    return health_checks.summarize(services)


@router.get("/colleges")
async def list_colleges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT c.id, c.name, c.location, c.city, c.state, c.type, c.active,
                   COALESCE(
                       json_agg(json_build_object('id', cc.id, 'active', cc.active))
                       FILTER (WHERE cc.id IS NOT NULL), '[]'
                   ) AS courses
            FROM colleges c
            LEFT JOIN college_courses cc ON cc.college_id = c.id
            GROUP BY c.id
            ORDER BY c.name
            """
        )
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/colleges", status_code=201)
async def create_college(body: CollegeCreate, db: AsyncSession = Depends(get_db)):
    college_id = uuid4()
    # An explicit slug wins; otherwise derive one from the name. Either way a
    # same-named second college collides on the unique constraint, which is a
    # 409 (supply an explicit slug) rather than a 500.
    slug = body.slug or make_slug(body.name)
    try:
        await db.execute(
            text(
                """
                INSERT INTO colleges
                    (id, name, slug, location, city, state, type, active,
                     landing_hero_image_url, landing_description,
                     landing_gallery_urls)
                VALUES (:id, :name, :slug, :location, :city, :state, :type, true,
                        :hero, :description, :gallery)
                """
            ),
            {
                "id": college_id,
                "name": body.name,
                "slug": slug,
                "location": body.location,
                "city": body.city,
                "state": body.state,
                "type": body.type,
                "hero": body.landing_hero_image_url,
                "description": body.landing_description,
                "gallery": dump_gallery(body.landing_gallery_urls),
            },
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A college with that slug already exists. Supply an explicit slug.",
        )
    await _audit(db, "college.created", "college", college_id)
    await db.commit()
    return {"id": str(college_id)}


@router.get("/colleges/{college_id}")
async def get_college(college_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT c.id, c.name, c.slug, c.location, c.city, c.state, c.type, c.active,
                   c.landing_hero_image_url, c.landing_description,
                   c.landing_gallery_urls, c.application_phases, c.logo_url,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', cc.id, 'college_id', c.id,
                               'course_name', cc.course_name, 'stream', cc.stream,
                               'duration_years', cc.duration_years,
                               'seats', cc.seats,
                                'application_fee', cc.application_fee * 100,
                                'active', cc.active,
                                'application_start_date', cc.application_start_date,
                                'intake_info', cc.intake_info,
                                'closing_date', cc.closing_date
                           ) ORDER BY cc.course_name
                       ) FILTER (WHERE cc.id IS NOT NULL), '[]'
                   ) AS courses,
                   (SELECT count(*) FROM applications a WHERE a.college_id = c.id)
                       AS application_count,
                    (SELECT COALESCE(sum(oi.amount - (oi.amount::bigint * o.discount_amount)
                       / NULLIF(o.total_amount, 0)), 0)
                       FROM order_items oi
                       JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
                      WHERE oi.college_id = c.id) AS fees_collected
            FROM colleges c
            LEFT JOIN college_courses cc ON cc.college_id = c.id
            WHERE c.id = :cid
            GROUP BY c.id
            """
        ),
        {"cid": college_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="College not found")

    staff = await db.execute(
        text(
            """
            SELECT id, name, email, 'college' AS role, NULL AS org_name,
                   active, created_at
            FROM college_admins WHERE college_id = :cid ORDER BY created_at
            """
        ),
        {"cid": college_id},
    )
    detail = dict(row._mapping)
    detail["landing_gallery_urls"] = parse_gallery(detail.get("landing_gallery_urls"))
    return {**detail, "staff": [dict(r._mapping) for r in staff.fetchall()]}


@router.patch("/colleges/{college_id}")
async def update_college(
    college_id: UUID, body: CollegeUpdate, db: AsyncSession = Depends(get_db)
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    allowed = (
        "name",
        "location",
        "city",
        "state",
        "type",
        "active",
        "landing_hero_image_url",
        "landing_description",
        "landing_gallery_urls",
        "application_phases",
    )
    fields = [k for k in allowed if k in updates]
    if "landing_gallery_urls" in updates:
        updates["landing_gallery_urls"] = dump_gallery(updates["landing_gallery_urls"])
    assignments = ", ".join(f"{k} = :{k}" for k in fields)

    result = await db.execute(
        text(f"UPDATE colleges SET {assignments} WHERE id = :cid RETURNING id"),
        {**{k: updates[k] for k in fields}, "cid": college_id},
    )
    if not result.fetchone():
        await db.rollback()
        raise HTTPException(status_code=404, detail="College not found")
    await _audit(db, "college.updated", "college", college_id)
    await db.commit()
    return {"status": "updated"}


@router.post("/colleges/{college_id}/courses", status_code=201)
async def admin_create_course(
    college_id: UUID, body: CourseCreate, db: AsyncSession = Depends(get_db)
):
    """
    An admin adds a course exactly as the college would: same shape, same
    window validation, same paise convention. The college portal owns the
    day-to-day; this exists for onboarding and correction.
    """
    exists = await db.execute(
        text("SELECT 1 FROM colleges WHERE id = :cid"), {"cid": college_id}
    )
    if not exists.fetchone():
        raise HTTPException(status_code=404, detail="College not found")
    if (
        body.application_start_date
        and body.closing_date
        and body.application_start_date > body.closing_date
    ):
        raise HTTPException(
            status_code=422, detail="The application window cannot open after it closes"
        )
    course_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO college_courses
                (id, college_id, course_name, stream, duration_years, seats,
                 application_fee, application_start_date, intake_info,
                 closing_date, active)
            VALUES (:id, :cid, :name, :stream, :duration, :seats, :fee,
                    :start_date, :intake, :closing_date, true)
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
            "start_date": body.application_start_date,
            "intake": body.intake_info,
            "closing_date": body.closing_date,
        },
    )
    await _audit(db, "course.created", "course", course_id)
    await db.commit()
    return {"id": str(course_id)}


@router.patch("/colleges/{college_id}/courses/{course_id}")
async def admin_update_course(
    college_id: UUID,
    course_id: UUID,
    body: CourseUpdate,
    db: AsyncSession = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "application_fee" in updates:
        updates["application_fee"] //= 100

    allowed = (
        "seats",
        "application_fee",
        "application_start_date",
        "intake_info",
        "closing_date",
        "active",
    )
    fields = [k for k in allowed if k in updates]
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
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
    await _audit(db, "course.updated", "course", course_id)
    await db.commit()
    return {"status": "updated"}


@router.delete("/colleges/{college_id}/courses/{course_id}", status_code=204)
async def admin_delete_course(
    college_id: UUID, course_id: UUID, db: AsyncSession = Depends(get_db)
):
    """
    Remove a course outright. Refused when anything references it - an
    application, a shortlist entry, a priced order item - because deleting
    those would rewrite history. Deactivate (PATCH active=false) instead:
    the course disappears from every listing while its records stay intact.
    """
    dependents = await db.execute(
        text(
            """
            SELECT (SELECT count(*) FROM applications WHERE course_id = :course)
                 + (SELECT count(*) FROM shortlists WHERE course_id = :course)
                 + (SELECT count(*) FROM order_items WHERE course_id = :course)
            """
        ),
        {"course": course_id},
    )
    if (dependents.scalar_one() or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="This course has applications or shortlists. "
            "Deactivate it instead of deleting it.",
        )
    result = await db.execute(
        text(
            "DELETE FROM college_courses WHERE id = :course_id AND college_id = :cid"
        ),
        {"course_id": course_id, "cid": college_id},
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Course not found")
    await _audit(db, "course.deleted", "course", course_id)
    await db.commit()


@router.post("/colleges/{college_id}/logo")
async def upload_college_logo(
    college_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Set the college mark shown on the landing page and listings.

    PNG, JPG or WebP under 2 MB. Stored on local disk under /uploads and
    served by the backend itself - no object storage to configure for a
    handful of logos, at the cost of a volume in production compose.
    """
    exists = await db.execute(
        text("SELECT 1 FROM colleges WHERE id = :cid"), {"cid": college_id}
    )
    if not exists.fetchone():
        raise HTTPException(status_code=404, detail="College not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in LOGO_EXTS:
        raise HTTPException(
            status_code=422, detail="Upload a PNG, JPG or WebP image."
        )
    raw = await file.read()
    if len(raw) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="Keep logos under 2 MB.")

    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    for old in LOGO_DIR.glob(f"{college_id}.*"):
        old.unlink()
    destination = LOGO_DIR / f"{college_id}{ext}"
    destination.write_bytes(raw)

    logo_url = f"/uploads/logos/{college_id}{ext}"
    await db.execute(
        text("UPDATE colleges SET logo_url = :url WHERE id = :cid"),
        {"url": logo_url, "cid": college_id},
    )
    await _audit(db, "college.logo_updated", "college", college_id)
    await db.commit()
    logger.info("college logo updated id=%s size=%d", college_id, len(raw))
    return {"logo_url": logo_url}


@router.get("/coaching-centres")
async def list_centres(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT cc.id, cc.name, cc.city, cc.state, cc.active, cc.created_at,
                   cc.amount_per_lead, cc.credit_paise,
                   COALESCE(a.email, '') AS contact_email,
                   ''                    AS contact_phone,
                   (SELECT count(*) FROM student_coaching_links l
                     WHERE l.coaching_center_id = cc.id) AS student_count
            FROM coaching_centers cc
            LEFT JOIN coaching_center_admins a
                   ON a.coaching_center_id = cc.id AND a.active = true
            GROUP BY cc.id, a.email
            ORDER BY cc.name
            """
        )
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/coaching-centres", status_code=201)
async def create_centre(body: CentreCreate, db: AsyncSession = Depends(get_db)):
    centre_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO coaching_centers (id, name, city, state, active, amount_per_lead)
            VALUES (:id, :name, :city, :state, true, :rate)
            """
        ),
        {
            "id": centre_id,
            "name": body.name,
            "city": body.city,
            "state": body.state,
            "rate": body.amount_per_lead,
        },
    )
    await _audit(db, "coaching_centre.created", "coaching_centre", centre_id)
    await db.commit()
    return {"id": str(centre_id)}


@router.patch("/coaching-centres/{centre_id}")
async def update_centre(
    centre_id: UUID, body: CentreUpdate, db: AsyncSession = Depends(get_db)
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    allowed = ("active", "amount_per_lead", "credit_paise")
    fields = [k for k in allowed if k in updates]
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    assignments = ", ".join(f"{k} = :{k}" for k in fields)
    result = await db.execute(
        text(f"UPDATE coaching_centers SET {assignments} WHERE id = :cid RETURNING id"),
        {**{k: updates[k] for k in fields}, "cid": centre_id},
    )
    if not result.fetchone():
        await db.rollback()
        raise HTTPException(status_code=404, detail="Coaching centre not found")
    await _audit(db, "coaching_centre.updated", "coaching_centre", centre_id)
    await db.commit()
    return {"status": "updated"}


@router.get("/students")
async def list_students(
    search: Optional[str] = Query(None, max_length=120),
    stream: Optional[Literal["UG", "PG"]] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["1 = 1"]
    params: dict = {"limit": limit}
    if search:
        conditions.append(
            "(s.name ILIKE :search OR s.email ILIKE :search OR s.phone ILIKE :search)"
        )
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{escaped}%"
    if stream:
        conditions.append("s.stream = :stream")
        params["stream"] = stream

    result = await db.execute(
        text(
            f"""
            SELECT s.id, s.name, s.email, s.phone, s.stream, s.created_at,
                   cc.name AS coaching_centre_name,
                   COALESCE(sl.cnt, 0)  AS shortlist_count,
                   COALESCE(app.cnt, 0) AS application_count
            FROM students s
            LEFT JOIN student_coaching_links l ON l.student_id = s.id
            LEFT JOIN coaching_centers cc      ON cc.id = l.coaching_center_id
            LEFT JOIN (SELECT student_id, count(*) cnt FROM shortlists
                       GROUP BY student_id) sl ON sl.student_id = s.id
            LEFT JOIN (SELECT student_id, count(*) cnt FROM applications
                       GROUP BY student_id) app ON app.student_id = s.id
            WHERE {" AND ".join(conditions)}
            ORDER BY s.created_at DESC
            LIMIT :limit
            """
        ),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT ca.id, ca.name, ca.email, 'college' AS role,
                   c.name AS org_name, ca.active, ca.created_at
            FROM college_admins ca JOIN colleges c ON c.id = ca.college_id
            UNION ALL
            SELECT sa.id, sa.name, sa.email, 'coaching' AS role,
                   cc.name AS org_name, sa.active, sa.created_at
            FROM coaching_center_admins sa
            JOIN coaching_centers cc ON cc.id = sa.coaching_center_id
            UNION ALL
            SELECT pu.id, pu.name, pu.email, 'admin' AS role,
                   NULL AS org_name, pu.active, pu.created_at
            FROM platform_users pu
            ORDER BY created_at DESC
            """
        )
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/users", status_code=201)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Creates a staff account and grants its role in one step.

    The role and its organisation are validated together: a college account
    with no college is an account that passes require_roles("college") and then
    fails every scoped query behind it.
    """
    from firebase_admin import auth as firebase_auth

    if body.role == "college" and not body.college_id:
        raise HTTPException(status_code=422, detail="A college account needs a college")
    if body.role == "coaching" and not body.coaching_centre_id:
        raise HTTPException(status_code=422, detail="A coaching account needs a centre")
    if body.role == "admin" and (body.college_id or body.coaching_centre_id):
        raise HTTPException(
            status_code=422, detail="An admin account is not attached to an organisation"
        )

    email = body.email.lower().strip()

    # Create or adopt the Firebase user first: if this fails there is no
    # half-made row to clean up.
    try:
        fb_user = firebase_auth.get_user_by_email(email)
    except firebase_auth.UserNotFoundError:
        fb_user = firebase_auth.create_user(email=email, display_name=body.name)
    except Exception:
        logger.exception("Firebase lookup failed for %s", email)
        raise HTTPException(status_code=502, detail="Could not reach the auth provider")

    user_id = uuid4()
    if body.role == "college":
        await db.execute(
            text(
                """
                INSERT INTO college_admins
                    (id, firebase_uid, college_id, name, email, active)
                VALUES (:id, :uid, :org, :name, :email, true)
                """
            ),
            {
                "id": user_id,
                "uid": fb_user.uid,
                "org": body.college_id,
                "name": body.name,
                "email": email,
            },
        )
        assign_role(fb_user.uid, "college", college_id=str(body.college_id))
    elif body.role == "coaching":
        await db.execute(
            text(
                """
                INSERT INTO coaching_center_admins
                    (id, firebase_uid, coaching_center_id, name, email, active)
                VALUES (:id, :uid, :org, :name, :email, true)
                """
            ),
            {
                "id": user_id,
                "uid": fb_user.uid,
                "org": body.coaching_centre_id,
                "name": body.name,
                "email": email,
            },
        )
        assign_role(
            fb_user.uid, "coaching", coaching_centre_id=str(body.coaching_centre_id)
        )
    else:
        await db.execute(
            text(
                """
                INSERT INTO platform_users (id, firebase_uid, name, email, role, active)
                VALUES (:id, :uid, :name, :email, 'admin', true)
                """
            ),
            {"id": user_id, "uid": fb_user.uid, "name": body.name, "email": email},
        )
        assign_role(fb_user.uid, "admin")

    await _audit(db, f"user.created.{body.role}", "user", user_id)
    await db.commit()
    logger.info("staff account created role=%s id=%s", body.role, user_id)
    portal_path = {
        "college": "/college/dashboard",
        "coaching": "/coaching/dashboard",
        "admin": "/admin/dashboard",
    }[body.role]
    await send_email(
        email,
        f"Your {body.role} account on Edee Apply is ready",
        f"Hi {body.name},\n\n"
        "An administrator created your account. Sign in with this email "
        "address, then open your portal:\n"
        f"{portal_url(portal_path)}",
        purpose="staff-welcome",
    )
    return {"id": str(user_id), "email": email}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID, body: UserUpdate, db: AsyncSession = Depends(get_db)
):
    """
    Revoking clears the role claim and the refresh tokens, so access ends on
    the next request rather than whenever the current token happens to expire.
    """
    if body.active is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    firebase_uid = None
    found_role = None
    found_college_id = None
    found_centre_id = None
    for table, role in (
        ("college_admins", "college"),
        ("coaching_center_admins", "coaching"),
        ("platform_users", "admin"),
    ):
        org_columns = ""
        if table == "college_admins":
            org_columns = ", college_id"
        elif table == "coaching_center_admins":
            org_columns = ", coaching_center_id"

        result = await db.execute(
            text(
                f"UPDATE {table} SET active = :active WHERE id = :uid "
                f"RETURNING firebase_uid{org_columns}"
            ),
            {"active": body.active, "uid": user_id},
        )
        row = result.fetchone()
        if row:
            firebase_uid = row[0]
            found_role = role
            if table == "college_admins":
                found_college_id = row[1]
            elif table == "coaching_center_admins":
                found_centre_id = row[1]
            break

    if not firebase_uid:
        await db.rollback()
        raise HTTPException(status_code=404, detail="User not found")

    # firebase_uid is only set alongside found_role, so this is provably set here.
    assert found_role is not None

    if body.active:
        # Restoring must put the role claim back: revoke_access cleared it, and a
        # restored account without a claim can log in but is bounced out of
        # every portal.
        assign_role(
            firebase_uid,
            found_role,
            college_id=str(found_college_id) if found_college_id else None,
            coaching_centre_id=str(found_centre_id) if found_centre_id else None,
        )
        await _audit(db, "user.restored", "user", user_id)
        logger.info("staff account restored role=%s id=%s", found_role, user_id)
    else:
        revoke_access(firebase_uid)
        await _audit(db, "user.revoked", "user", user_id)
        logger.info("staff account revoked role=%s id=%s", found_role, user_id)

    await db.commit()
    return {"status": "active" if body.active else "revoked", "role": found_role}


@router.get("/payments")
async def list_payments(
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["1 = 1"]
    params: dict = {"limit": limit}
    if search:
        conditions.append("(s.name ILIKE :search OR p.razorpay_payment_id ILIKE :search)")
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{escaped}%"

    result = await db.execute(
        text(
            f"""
            SELECT p.id, s.name AS student_name, p.razorpay_payment_id,
                   p.amount, p.status, p.verified_at
            FROM payments p
            JOIN orders o   ON o.id = p.order_id
            JOIN students s ON s.id = o.student_id
            WHERE {" AND ".join(conditions)}
            ORDER BY p.verified_at DESC
            LIMIT :limit
            """
        ),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/audit")
async def list_audit(
    actor_role: Optional[Literal["student", "college", "coaching", "admin", "system"]] = Query(
        None
    ),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["1 = 1"]
    params: dict = {"limit": limit}
    if actor_role:
        conditions.append("actor_role = :actor_role")
        params["actor_role"] = actor_role

    result = await db.execute(
        text(
            f"""
            SELECT id, actor_role, action, entity_type, entity_id, created_at
            FROM audit_events
            WHERE {" AND ".join(conditions)}
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/contact-messages")
async def list_contact_messages(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT id, name, email, purpose, message, created_at
            FROM contact_messages
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    return [dict(r._mapping) for r in result.fetchall()]
