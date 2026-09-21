"""
The parts of student signup that both sign-in paths share.

There are two ways to become a student now: authenticate with Firebase and
complete a profile (POST /students/), or sign up with an email and password
(POST /auth/signup). What happens *after* the identity is settled is identical
in both - the same row, the same clash rules, the same invite-code redemption,
the same welcome mail - so it lives here rather than being written twice and
drifting apart.

Everything in this module assumes the caller opened the transaction and will
commit it. Invite redemption in particular must land in the same transaction
as the student row: a redeemed code with no student behind it burns a use for
nobody.
"""
import logging
import uuid
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.email import portal_url, send_email
from app.services.leads import apply_interests

logger = logging.getLogger(__name__)


async def ensure_unused(db: AsyncSession, email: str, phone: str) -> None:
    """
    Refuse an email or phone number that is already a student.

    Checked here for a clean 409; the unique indexes are what actually
    guarantee it. Both are reported together on purpose - saying which one
    clashed tells a stranger whether a given address has an account.
    """
    clash = await db.execute(
        text("SELECT 1 FROM students WHERE email = :email OR phone = :phone LIMIT 1"),
        {"email": email, "phone": phone},
    )
    if clash.fetchone():
        raise HTTPException(
            status_code=409, detail="That email or phone number is already registered"
        )


async def insert_student(
    db: AsyncSession,
    *,
    uid: str,
    name: str,
    email: str,
    phone: str,
    stream: str,
) -> UUID:
    """Write the student row. `uid` goes into firebase_uid whatever minted it."""
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
            "firebase_uid": uid,
            "name": name,
            "email": email,
            "phone": phone,
            "stream": stream,
        },
    )
    return student_id


async def redeem_invite_code(
    db: AsyncSession, student_id: UUID, code: str, email: str
) -> None:
    """
    Link a new student to the coaching centre whose code they entered.

    Rolls back and raises 400 if the code is unusable. Three things happen on
    success, and all three belong in the caller's transaction:

    1. The use is claimed under a row lock, so two students racing the last
       use of a capped code cannot both win it.
    2. A lead the institute bulk-uploaded graduates to signed_up, so their
       cumulative database reflects reality instead of going stale the moment
       somebody converts.
    3. Whatever the institute shortlisted on that lead's behalf becomes real
       shortlist rows. Best effort - unknown or closed courses are skipped,
       never errors.
    """
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
        {"code": code, "student_id": student_id, "link_id": uuid.uuid4()},
    )
    if link_result.rowcount == 0:
        # Could be unknown, expired, or exhausted. Do not distinguish in the
        # body: the exact reason is not something a stranger needs to probe.
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="That invite code is not valid or has already been used up",
        )

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
        {"code": code, "student_id": student_id, "email": email},
    )

    lead = await db.execute(
        text(
            """
            SELECT cs.interests FROM coaching_students cs
            JOIN coaching_invites ci
              ON ci.coaching_center_id = cs.coaching_center_id
            WHERE ci.code = :code AND cs.email = :email
            """
        ),
        {"code": code, "email": email},
    )
    lead_row = lead.fetchone()
    if lead_row is not None and lead_row[0]:
        await apply_interests(db, student_id, lead_row[0])


async def send_welcome(email: str, name: str) -> None:
    """Best-effort, like every send: a mail server hiccup must not fail signup."""
    await send_email(
        email,
        "Your Edee Apply profile is ready",
        f"Hi {name},\n\n"
        "Your profile is created. Shortlist the courses you want and pay "
        f"once for all of them:\n{portal_url('/student/colleges')}",
        purpose="signup",
    )
