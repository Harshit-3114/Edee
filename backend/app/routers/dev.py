"""
Development-only helpers.

Every route here 404s unless dev mode is on — local development without
Firebase — so none of this exists in test, staging or production, not even
as a 403 oracle. The dev sign-in page uses /dev/directory to offer real
college and coaching-centre ids for dev: tokens.
"""
import hashlib
import logging
import re
from typing import Literal, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db.connection import get_db
from app.middleware.auth import get_current_user, require_roles
from app.core import devmode
from app.core.rate_limit import limited
from app.models.payment import CreateOrder
from app.routers.payments import _price_shortlist, _student_id, format_amount, fulfill_order
from app.services.email import portal_url, send_email

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_dev_mode() -> None:
    if not devmode.is_dev_mode():
        raise HTTPException(status_code=404, detail="Not found")


TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$")


def _mock_identity(uid: str) -> tuple:
    """Deterministic email + phone for a mock uid. Stable across restarts so
    re-running the server never collides with last run's rows.

    The domain is a subdomain of example.com: deliverable-looking enough to
    pass EmailStr validation, reserved enough to never be real.
    """
    digest = hashlib.sha256(uid.encode()).hexdigest()
    email = re.sub(r"[^a-z0-9_-]", "", uid.replace(":", "-").lower())[:60]
    phone = str(6000000000 + int(digest, 16) % 4000000000)
    return f"{email}@devmock.example.com", phone


class MockUserIn(BaseModel):
    role: Literal["student", "college", "coaching", "admin"]
    tag: Optional[str] = Field(default=None, max_length=40)
    # The student's mobile number. Any 10 digits work in dev mode - it is the
    # mock login identity, not a verified number.
    phone: Optional[str] = Field(default=None, max_length=20)
    college_id: Optional[UUID] = None
    coaching_centre_id: Optional[UUID] = None


@router.get("/directory")
async def directory(db: AsyncSession = Depends(get_db)):
    """Colleges and coaching centres to sign in as while developing."""
    _require_dev_mode()
    colleges = await db.execute(
        text(
            "SELECT id, name, slug FROM colleges "
            "WHERE active = true ORDER BY name"
        )
    )
    centres = await db.execute(
        text(
            "SELECT id, name FROM coaching_centers "
            "WHERE active = true ORDER BY name"
        )
    )
    return {
        "colleges": [dict(row._mapping) for row in colleges.fetchall()],
        "coaching_centres": [dict(row._mapping) for row in centres.fetchall()],
    }


@router.post("/mock-user", status_code=201)
async def mock_user(body: MockUserIn, db: AsyncSession = Depends(get_db)):
    """
    Provision a mock user with real database rows behind it.

    A bare dev: token carries claims but no rows, so half the site 404s:
    the dashboard finds no profile, shortlisting finds no student, the
    portals find no staff record. This writes the rows the token's journey
    needs, idempotently: signing in twice as the same tag reuses the same
    rows instead of tripping unique constraints.
    """
    _require_dev_mode()

    # No mock admins, even in dev: the admin panel answers only to the
    # seeded admin credential in auth_credentials. Anything else - a second
    # admin, a throwaway - is created by that admin through the product.
    if body.role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Mock admins are disabled - sign in with the seeded admin account",
        )

    tag = (body.tag or "").strip()
    if tag and not TAG_RE.match(tag):
        raise HTTPException(
            status_code=422,
            detail="Tag may only contain letters, digits, _ and -",
        )

    if body.role == "college":
        if not body.college_id:
            raise HTTPException(status_code=422, detail="A college mock needs a college")
        org = await db.execute(
            text("SELECT name FROM colleges WHERE id = :cid AND active = true"),
            {"cid": body.college_id},
        )
        org_row = org.fetchone()
        if not org_row:
            raise HTTPException(status_code=404, detail="College not found")
        token = f"dev:college:{body.college_id}"
        display = f"Dev {org_row[0]}"
    elif body.role == "coaching":
        if not body.coaching_centre_id:
            raise HTTPException(status_code=422, detail="A coaching mock needs a centre")
        org = await db.execute(
            text("SELECT name FROM coaching_centers WHERE id = :cid AND active = true"),
            {"cid": body.coaching_centre_id},
        )
        org_row = org.fetchone()
        if not org_row:
            raise HTTPException(status_code=404, detail="Coaching centre not found")
        token = f"dev:coaching:{body.coaching_centre_id}"
        display = f"Dev {org_row[0]}"
    else:
        token = f"dev:{body.role}:{tag}" if tag else f"dev:{body.role}"
        display = f"Dev {(tag or body.role).title()}"

    email, derived_phone = _mock_identity(token)
    if body.role == "student":
        digits = re.sub(r"\D", "", body.phone or "")
        phone = digits if re.fullmatch(r"\d{10}", digits) else derived_phone
        try:
            await db.execute(
                text(
                    """
                    INSERT INTO students (id, firebase_uid, name, email, phone, stream)
                    VALUES (:id, :uid, :name, :email, :phone, 'UG')
                    ON CONFLICT (firebase_uid) DO UPDATE
                    SET name = EXCLUDED.name, email = EXCLUDED.email,
                        phone = EXCLUDED.phone
                    """
                ),
                {"id": uuid4(), "uid": token, "name": display, "email": email, "phone": phone},
            )
        except IntegrityError:
            # The number belongs to a real registered student. A mock cannot
            # wear it; sign in with Firebase instead.
            await db.rollback()
            raise HTTPException(
                status_code=409, detail="That number is already registered"
            )
    elif body.role == "college":
        await db.execute(
            text(
                """
                INSERT INTO college_admins
                    (id, firebase_uid, college_id, name, email, active)
                VALUES (:id, :uid, :org, :name, :email, true)
                ON CONFLICT (firebase_uid) DO UPDATE
                SET college_id = EXCLUDED.college_id, name = EXCLUDED.name,
                    email = EXCLUDED.email, active = true
                """
            ),
            {
                "id": uuid4(),
                "uid": token,
                "org": body.college_id,
                "name": display,
                "email": email,
            },
        )
    elif body.role == "coaching":
        await db.execute(
            text(
                """
                INSERT INTO coaching_center_admins
                    (id, firebase_uid, coaching_center_id, name, email, active)
                VALUES (:id, :uid, :org, :name, :email, true)
                ON CONFLICT (firebase_uid) DO UPDATE
                SET coaching_center_id = EXCLUDED.coaching_center_id,
                    name = EXCLUDED.name, email = EXCLUDED.email, active = true
                """
            ),
            {
                "id": uuid4(),
                "uid": token,
                "org": body.coaching_centre_id,
                "name": display,
                "email": email,
            },
        )
    else:
        await db.execute(
            text(
                """
                INSERT INTO platform_users
                    (id, firebase_uid, name, email, role, active)
                VALUES (:id, :uid, :name, :email, 'admin', true)
                ON CONFLICT (firebase_uid) DO UPDATE
                SET name = EXCLUDED.name, email = EXCLUDED.email, active = true
                """
            ),
            {"id": uuid4(), "uid": token, "name": display, "email": email},
        )

    await db.commit()
    logger.info("mock user provisioned role=%s uid=%s", body.role, token)
    return {"token": token}


async def _delete_mock_rows(db: AsyncSession, uid: str) -> None:
    """Remove one mock identity and everything it created, FK-order first."""
    student = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"), {"uid": uid}
    )
    row = student.fetchone()
    if row is not None:
        sid = row[0]
        # applications first: they hold payment_id, so payments cannot go first.
        await db.execute(
            text("DELETE FROM applications WHERE student_id = :sid"), {"sid": sid}
        )
        await db.execute(
            text("DELETE FROM shortlists WHERE student_id = :sid"), {"sid": sid}
        )
        await db.execute(
            text("DELETE FROM payments WHERE order_id IN "
                 "(SELECT id FROM orders WHERE student_id = :sid)"),
            {"sid": sid},
        )
        await db.execute(
            text("DELETE FROM orders WHERE student_id = :sid"), {"sid": sid}
        )
        await db.execute(
            text("DELETE FROM student_coaching_links WHERE student_id = :sid"),
            {"sid": sid},
        )
        await db.execute(
            text("UPDATE coaching_students SET student_id = NULL WHERE student_id = :sid"),
            {"sid": sid},
        )
        await db.execute(text("DELETE FROM students WHERE id = :sid"), {"sid": sid})

    await db.execute(
        text("DELETE FROM notifications WHERE recipient_uid = :uid"), {"uid": uid}
    )
    for table in ("college_admins", "coaching_center_admins", "platform_users"):
        await db.execute(
            text(f"DELETE FROM {table} WHERE firebase_uid = :uid"), {"uid": uid}
        )


@router.post("/mock-capture")
@limited("30/minute")
async def mock_capture(
    request: Request,
    body: CreateOrder,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """
    Pay without paying, for the dev walkthrough.

    Runs the exact pricing path as create-order (same re-pricing, same
    availability checks, same scholarship) and the exact fulfillment as the
    webhook (same applications, audit rows, notifications) - then marks it
    all dev_ so no row can ever be mistaken for real money. The frontend
    says so on screen.
    """
    _require_dev_mode()
    student_id = await _student_id(user, db)
    priced, total_paise, discount, payable = await _price_shortlist(
        db, student_id, body.shortlist_ids
    )

    order_id = uuid4()
    fake_payment_id = f"dev_{uuid4().hex[:16]}"
    fake_order_id = f"dev_{uuid4().hex[:16]}"
    await db.execute(
        text(
            """
            INSERT INTO orders
                (id, student_id, razorpay_order_id, amount, total_amount,
                 discount_amount, currency, status)
            VALUES (:id, :student_id, :razorpay_order_id, :amount, :total,
                    :discount, 'INR', 'created')
            """
        ),
        {
            "id": order_id,
            "student_id": student_id,
            "razorpay_order_id": fake_order_id,
            "amount": payable,
            "total": total_paise,
            "discount": discount,
        },
    )
    for row, amount in priced:
        await db.execute(
            text(
                """
                INSERT INTO order_items
                    (id, order_id, shortlist_id, college_id, course_id, amount)
                VALUES (:id, :order_id, :shortlist_id, :college_id, :course_id, :amount)
                """
            ),
            {
                "id": uuid4(),
                "order_id": order_id,
                "shortlist_id": row.shortlist_id,
                "college_id": row.college_id,
                "course_id": row.course_id,
                "amount": amount,
            },
        )

    order = (
        await db.execute(
            text("SELECT id, student_id, amount, status FROM orders WHERE id = :id"),
            {"id": order_id},
        )
    ).fetchone()
    summary = await fulfill_order(db, order, fake_payment_id, "dev", payable)
    if summary.get("status") == "no_order_items":
        await db.rollback()
        raise HTTPException(status_code=500, detail="Mock payment failed")
    await db.commit()
    logger.info(
        "mock capture student=%s applications=%d payable=%d",
        student_id,
        summary["applications"],
        payable,
    )
    if summary["student"] is not None:
        await send_email(
            summary["student"]["email"],
            "Payment received (dev mode - no money moved)",
            f"Hi {summary['student']['name']},\n\n"
            f"This is what a receipt for {format_amount(payable)} would look like. "
            "Dev mode is on, so nothing was charged.\n\n"
            f"Track the applications here:\n{portal_url('/student/dashboard?paid=1')}",
            purpose="payment-receipt",
        )
    return {"status": "ok", "applications": summary["applications"], "dev": True}


@router.delete("/mock-user", status_code=204)
async def delete_mock_user(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete the caller's mock rows on sign-out.

    A non-dev uid (or no mock rows at all) is a silent no-op: this shares the
    sign-out path with real Firebase sessions, which have nothing to delete.
    """
    _require_dev_mode()
    uid = str(user.get("uid") or "")
    if not uid.startswith("dev:"):
        return
    await _delete_mock_rows(db, uid)
    await db.commit()
    logger.info("mock user deleted uid=%s", uid)


async def cleanup_all_mock_users() -> int:
    """
    Best-effort wipe of every mock identity. Runs at server shutdown in dev
    mode so a mock user never survives the process that made it. Never raises:
    shutdown must not fail because cleanup did.
    """
    from app.db.connection import get_session_factory

    removed = 0
    try:
        async with get_session_factory()() as session:
            for table, column in (
                ("students", "firebase_uid"),
                ("college_admins", "firebase_uid"),
                ("coaching_center_admins", "firebase_uid"),
                ("platform_users", "firebase_uid"),
            ):
                uids = (
                    await session.execute(
                        text(f"SELECT {column} FROM {table} WHERE {column} LIKE 'dev:%'")
                    )
                ).fetchall()
                for (uid,) in uids:
                    try:
                        async with session.begin_nested():
                            await _delete_mock_rows(session, uid)
                        removed += 1
                    except Exception:
                        logger.exception("Could not clean up mock user %s", uid)
            # Leads a mock coach uploaded keep their centre's history, but a
            # signed-up link to a deleted mock student must not dangle.
            await session.execute(
                text(
                    "DELETE FROM coaching_students "
                    "WHERE email LIKE '%@devmock.example.com' AND student_id IS NULL"
                )
            )
            await session.commit()
    except Exception:
        logger.exception("Mock user cleanup failed")
    return removed
