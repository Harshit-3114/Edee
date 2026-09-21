"""
Session cookie exchange.

The browser signs in with Firebase and holds an ID token. That token lives in
JavaScript, so a React Server Component - which runs before any JavaScript does
- has no way to read it, and cannot fetch anything on the user's behalf. Every
portal page therefore had to render empty and fill itself in after hydration.

This router closes that gap. The client trades its ID token for a session
cookie, the Next.js server stores that cookie httpOnly on its own origin, and
from then on it can render a page with the user's data already in it.

Why a session cookie rather than stashing the ID token: an ID token lasts an
hour and cannot be revoked before it expires, so parking one in a cookie hands
an attacker a full hour on a stolen session. A session cookie is revocable -
verify_session_cookie(check_revoked=True) rejects it the moment the account's
refresh tokens are revoked.

The second half of this module is the local email/password path: signup, login,
password change and the staff invite links. It exists because identity here was
Firebase's entirely, so with no service account configured nobody could sign in
at all. It runs beside the Firebase endpoints above rather than replacing them,
and both can be live at once.
"""
import hashlib
import logging
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import local_token
from app.core.config import settings
from app.core.devmode import is_dev_mode, parse_dev_token
from app.core.rate_limit import limited
from app.db.connection import get_db
from app.middleware.auth import _firebase_app, get_current_user, require_roles
from app.models.auth import (
    PHONE_RE,
    InviteAcceptIn,
    InviteCreateIn,
    InviteDetail,
    InviteOut,
    LoginIn,
    PasswordChangeIn,
    SignupIn,
    TokenOut,
)
from app.services.email import portal_url, send_email
from app.services.passwords import hash_password, needs_rehash, verify_password
from app.services.signup import (
    ensure_unused,
    insert_student,
    redeem_invite_code,
    send_welcome,
)

logger = logging.getLogger(__name__)

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


class SessionOut(BaseModel):
    session: str
    expires_in: int


class MeOut(BaseModel):
    uid: str
    role: str | None = None
    college_id: str | None = None
    coaching_centre_id: str | None = None


@router.get("/me", response_model=MeOut)
async def whoami(user: dict = Depends(get_current_user)):
    """
    The verified identity behind the current credential.

    This is what lets the Next.js server open the role gate before any
    JavaScript runs. Without it the server can hold a session cookie and still
    not know whose it is, so every portal page has to render "Checking your
    access" and decide after hydration - which is most of the delay the session
    cookie was meant to remove.

    Claims only. Nothing here touches the database, so it stays cheap enough to
    call on every portal render.
    """
    return MeOut(
        uid=str(user.get("uid") or ""),
        role=user.get("role"),
        college_id=user.get("college_id"),
        coaching_centre_id=user.get("coaching_centre_id"),
    )


@router.post("/session", response_model=SessionOut)
async def create_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    """
    Exchange a freshly minted Firebase ID token for a session cookie.

    The ID token is the proof; it is verified here before anything is issued.
    The caller is the Next.js route handler, which stores the result httpOnly
    and never lets it reach client JavaScript.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    expires_in = settings.SESSION_MAX_AGE_SECONDS

    # A local session token already is a session: this API signed it and it
    # carries its own expiry, so there is nothing to exchange it for. Verified
    # rather than waved through, so a forged one fails here instead of
    # becoming a cookie that fails on every subsequent request.
    if local_token.is_local_token(token):
        claims = local_token.verify(token)
        if claims is None:
            raise HTTPException(status_code=401, detail="Sign in again")
        remaining = int(claims["exp"]) - int(time.time())
        return SessionOut(session=token, expires_in=max(remaining, 0))

    # Dev mode has no Admin SDK to mint anything, so the dev token is its own
    # session. It is still parsed, so a malformed one fails here rather than
    # becoming an unverifiable cookie.
    if is_dev_mode():
        if parse_dev_token(token) is None:
            raise HTTPException(status_code=401, detail="Invalid dev token")
        return SessionOut(session=token, expires_in=expires_in)

    try:
        # Verified first: create_session_cookie would accept the token anyway,
        # but this returns a clean 401 for an expired one instead of a 500,
        # and refuses a token whose account was disabled a moment ago.
        firebase_auth.verify_id_token(token, check_revoked=True, app=_firebase_app())
        cookie = firebase_auth.create_session_cookie(
            token, expires_in=timedelta(seconds=expires_in), app=_firebase_app()
        )
    except (
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.RevokedIdTokenError,
        firebase_auth.InvalidIdTokenError,
    ):
        raise HTTPException(status_code=401, detail="Sign in again")
    except firebase_auth.UserDisabledError:
        raise HTTPException(status_code=403, detail="This account is disabled")
    except Exception:
        logger.exception("Could not mint a session cookie")
        raise HTTPException(status_code=401, detail="Authentication failed")

    return SessionOut(session=cookie, expires_in=expires_in)


@router.delete("/session", status_code=204)
async def revoke_session(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke every session this account holds.

    Clearing the cookie on the Next.js side ends the session in that browser.
    This ends it everywhere, which is what a user signing out of a shared
    machine actually wants. Dev mode has nothing to revoke.
    """
    # A local session is revoked by moving the account's token_version past
    # the one every outstanding token carries. Same effect as revoking refresh
    # tokens, and it takes hold on the very next request.
    if user.get("local"):
        await db.execute(
            text(
                "UPDATE auth_credentials "
                "SET token_version = token_version + 1 WHERE uid = :uid"
            ),
            {"uid": user["uid"]},
        )
        await db.commit()
        return

    if is_dev_mode():
        return

    uid = user.get("uid")
    if not uid:
        return

    try:
        firebase_auth.revoke_refresh_tokens(uid, app=_firebase_app())
    except Exception:
        # The cookie is being dropped regardless; a failed revoke must not
        # leave the user stuck on a page they asked to leave.
        logger.exception("Could not revoke refresh tokens for %s", uid)


# ---------------------------------------------------------------------------
# Local email/password sign-in.
#
# A second identity path, running beside the Firebase one above rather than
# replacing it. Everything here mints or checks an `edee1.` token; the Firebase
# endpoints are untouched, and the two can be live at the same time.
# ---------------------------------------------------------------------------

# The two roles that arrive by invite, and the table each one lands in.
STAFF_TABLE = {
    "college": ("college_admins", "college_id"),
    "coaching": ("coaching_center_admins", "coaching_center_id"),
}

_dummy_hash: str | None = None


def _timing_decoy() -> str:
    """
    A real hash to check a password against when no account matched.

    Returning early for an unknown address makes the response measurably
    faster than one for a known address, which turns sign-in into a "does this
    person have an account here" oracle. Verifying against a throwaway hash
    costs the same as the real thing.

    Built on first use, not at import: bcrypt at cost 12 is a few hundred
    milliseconds, and boot should not pay for it when nobody signs in.
    """
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password(secrets.token_urlsafe(24))
    return _dummy_hash


def _issue(row) -> TokenOut:
    """Mint a token for a credential row that has just been verified."""
    college_id = str(row.college_id) if row.college_id else None
    coaching_centre_id = (
        str(row.coaching_centre_id) if row.coaching_centre_id else None
    )
    token = local_token.mint(
        uid=row.uid,
        role=row.role,
        token_version=row.token_version,
        email=row.email,
        college_id=college_id,
        coaching_centre_id=coaching_centre_id,
    )
    return TokenOut(
        token=token,
        expires_in=settings.SESSION_MAX_AGE_SECONDS,
        role=row.role,
        college_id=college_id,
        coaching_centre_id=coaching_centre_id,
    )


async def _credential_by_uid(db: AsyncSession, uid: str):
    return (
        await db.execute(
            text(
                """
                SELECT uid, email, role, college_id, coaching_centre_id,
                       token_version
                FROM auth_credentials WHERE uid = :uid
                """
            ),
            {"uid": uid},
        )
    ).fetchone()


async def _insert_credential(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    role: str,
    college_id=None,
    coaching_centre_id=None,
) -> str:
    """
    Write a credential row and return the uid it minted.

    The uid is what goes into the `firebase_uid` column of whichever identity
    table matches the role, which is how a local account becomes visible to
    every query that was written for a Firebase one.
    """
    uid = f"local:{uuid.uuid4()}"
    await db.execute(
        text(
            """
            INSERT INTO auth_credentials
                (id, uid, email, password_hash, role, college_id, coaching_centre_id)
            VALUES
                (:id, :uid, :email, :hash, :role, :college_id, :coaching_centre_id)
            """
        ),
        {
            "id": uuid.uuid4(),
            "uid": uid,
            "email": email,
            "hash": hash_password(password),
            "role": role,
            "college_id": college_id,
            "coaching_centre_id": coaching_centre_id,
        },
    )
    return uid


@router.post("/signup", response_model=TokenOut, status_code=201)
@limited("5/minute")
async def signup(
    request: Request,
    body: SignupIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a student account from name, email, phone and password.

    Students only, and not by configuration - there is no role field in the
    body to ask for anything else. College and coaching accounts come from an
    admin's invite link and the admin account is seeded, so this is the only
    endpoint on the platform where a stranger can create an account. That is
    what "only the student portal has signup" means in practice.

    The credential and the student row are one transaction. Half a signup is
    worse than none: a credential with no student row signs in to a portal
    with nothing behind it, and a student row with no credential belongs to
    nobody.
    """
    email = str(body.email).lower().strip()

    taken = await db.execute(
        text("SELECT 1 FROM auth_credentials WHERE email = :email"), {"email": email}
    )
    if taken.fetchone():
        raise HTTPException(
            status_code=409, detail="That email or phone number is already registered"
        )

    await ensure_unused(db, email, body.phone)

    try:
        uid = await _insert_credential(
            db, email=email, password=body.password, role="student"
        )
        student_id = await insert_student(
            db,
            uid=uid,
            name=body.name,
            email=email,
            phone=body.phone,
            stream=body.stream,
        )

        if body.invite_code:
            await redeem_invite_code(db, student_id, body.invite_code, email)

        await db.commit()
    except IntegrityError:
        # Two signups racing the same address. The unique indexes are what
        # actually decide it; this turns the loser's crash into a 409.
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="That email or phone number is already registered"
        )

    logger.info(
        "student signed up locally id=%s stream=%s invite=%s",
        student_id,
        body.stream,
        bool(body.invite_code),
    )
    await send_welcome(email, body.name)

    return _issue(await _credential_by_uid(db, uid))


@router.post("/login", response_model=TokenOut)
@limited("10/minute")
async def login(
    request: Request,
    body: LoginIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange an email or phone number plus password for a session token.

    Used by all four portals. Students may sign in with either the email or
    the mobile number they signed up with; staff accounts have no phone, so
    only an email reaches them. The response says which role the account holds
    and the caller decides where to send them, exactly as the Firebase path
    does - so signing in at the wrong door is caught by the same UI, with the
    same offer to continue to the right one.

    Every failure returns the same message. "No such account", "wrong
    password" and "account disabled" are three different facts, and handing
    them to an anonymous caller turns this endpoint into a directory.
    """
    identifier = body.identifier.strip()
    digits = re.sub(r"\D", "", identifier)[-10:]

    if PHONE_RE.match(digits):
        # Student phone login. The phone lives on the student row; its uid
        # bridges to the credential, so a Firebase-only student (no password
        # row) reads as a wrong password, exactly like an unknown number.
        student = (
            await db.execute(
                text("SELECT firebase_uid FROM students WHERE phone = :phone"),
                {"phone": digits},
            )
        ).fetchone()
        row = (
            (
                await db.execute(
                    text(
                        """
                        SELECT id, uid, email, password_hash, role, college_id,
                               coaching_centre_id, active, token_version
                        FROM auth_credentials WHERE uid = :uid
                        """
                    ),
                    {"uid": student.firebase_uid},
                )
            ).fetchone()
            if student
            else None
        )
    else:
        email = identifier.lower()
        row = (
            await db.execute(
                text(
                    """
                    SELECT id, uid, email, password_hash, role, college_id,
                           coaching_centre_id, active, token_version
                    FROM auth_credentials WHERE email = :email
                    """
                ),
                {"email": email},
            )
        ).fetchone()

    stored = row.password_hash if row else _timing_decoy()
    matched = verify_password(body.password, stored)

    if row is None or not matched or not row.active:
        logger.info("failed local sign-in")
        raise HTTPException(status_code=401, detail="Email or password is incorrect")

    # A successful verify is the only moment the plaintext exists, so it is the
    # only chance to lift an old hash to the current cost without making
    # anybody reset anything.
    if needs_rehash(row.password_hash):
        await db.execute(
            text("UPDATE auth_credentials SET password_hash = :hash WHERE id = :id"),
            {"hash": hash_password(body.password), "id": row.id},
        )
        await db.commit()

    return _issue(row)


@router.post("/password", response_model=TokenOut)
@limited("5/minute")
async def change_password(
    request: Request,
    body: PasswordChangeIn,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change your own password.

    The current password is required even though the caller is already
    authenticated: otherwise a borrowed session - an unlocked laptop, a stolen
    cookie - is enough to lock the real owner out of their own account.

    Every other session is dropped, which is the point. If the reason for
    changing it is that somebody else had it, leaving their session alive
    defeats the exercise. The caller gets a fresh token back, so the browser
    they are sitting at stays signed in.
    """
    if not user.get("local"):
        raise HTTPException(
            status_code=400,
            detail="This account signs in through Google or a mobile number",
        )

    row = (
        await db.execute(
            text(
                """
                SELECT id, password_hash FROM auth_credentials WHERE uid = :uid
                """
            ),
            {"uid": user["uid"]},
        )
    ).fetchone()
    if row is None or not verify_password(body.current_password, row.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    await db.execute(
        text(
            """
            UPDATE auth_credentials
            SET password_hash = :hash,
                password_changed_at = now(),
                token_version = token_version + 1
            WHERE id = :id
            """
        ),
        {"hash": hash_password(body.password), "id": row.id},
    )
    await db.commit()

    logger.info("password changed for %s", user["uid"])
    return _issue(await _credential_by_uid(db, user["uid"]))


# ---------------------------------------------------------------------------
# Staff invites.
#
# College and coaching accounts have no signup. An admin issues a single-use
# link; whoever opens it chooses a password and the account exists from that
# moment. Only the sha256 of the token is stored, so this table leaking does
# not hand anybody a staff account.
# ---------------------------------------------------------------------------


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _load_open_invite(db: AsyncSession, token: str, *, lock: bool = False):
    """An invite that exists, has not been used, and has not expired."""
    row = (
        await db.execute(
            text(
                """
                SELECT id, email, name, role, college_id, coaching_centre_id,
                       expires_at, used_at
                FROM auth_invites
                WHERE token_hash = :hash
                """
                + (" FOR UPDATE" if lock else "")
            ),
            {"hash": _hash_token(token)},
        )
    ).fetchone()

    # One message for missing, used and expired alike. An invite link is a
    # bearer credential, and which of the three it is is not a stranger's
    # business.
    if (
        row is None
        or row.used_at is not None
        or row.expires_at <= datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=404, detail="This invite link is not valid any more"
        )
    return row


async def _organisation_name(db: AsyncSession, role: str, college_id, centre_id):
    table = "colleges" if role == "college" else "coaching_centers"
    org_id = college_id if role == "college" else centre_id
    row = (
        await db.execute(
            text(f"SELECT name FROM {table} WHERE id = :id"), {"id": org_id}
        )
    ).fetchone()
    return row.name if row else None


@router.post("/invites", response_model=InviteOut, status_code=201)
async def create_invite(
    body: InviteCreateIn,
    user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Issue a set-password link for a college or coaching account."""
    email = str(body.email).lower().strip()

    if body.role == "college" and not body.college_id:
        raise HTTPException(status_code=400, detail="Choose a college")
    if body.role == "coaching" and not body.coaching_centre_id:
        raise HTTPException(status_code=400, detail="Choose a coaching centre")

    taken = await db.execute(
        text("SELECT 1 FROM auth_credentials WHERE email = :email"), {"email": email}
    )
    if taken.fetchone():
        raise HTTPException(status_code=409, detail="That email already has an account")

    organisation = await _organisation_name(
        db, body.role, body.college_id, body.coaching_centre_id
    )
    if organisation is None:
        raise HTTPException(status_code=404, detail="That organisation does not exist")

    # The only copy of the token. It goes into the link and is never stored, so
    # an admin who loses it reissues rather than looks it up.
    raw = secrets.token_urlsafe(32)
    invite_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.INVITE_TTL_DAYS)

    await db.execute(
        text(
            """
            INSERT INTO auth_invites
                (id, token_hash, email, name, role, college_id,
                 coaching_centre_id, expires_at, created_by)
            VALUES
                (:id, :hash, :email, :name, :role, :college_id,
                 :coaching_centre_id, :expires_at, :created_by)
            """
        ),
        {
            "id": invite_id,
            "hash": _hash_token(raw),
            "email": email,
            "name": body.name.strip(),
            "role": body.role,
            "college_id": body.college_id,
            "coaching_centre_id": body.coaching_centre_id,
            "expires_at": expires_at,
            "created_by": None,
        },
    )
    await db.commit()

    url = portal_url(f"/set-password?token={raw}")
    logger.info("invite issued role=%s org=%s", body.role, organisation)

    # Best effort, like every send. The URL comes back in the response too, so
    # an admin can hand it over directly when mail is not configured.
    await send_email(
        email,
        "Set up your Edee Apply account",
        f"Hi {body.name.strip()},\n\n"
        f"An account has been created for {organisation} on Edee Apply. "
        f"Choose a password to finish setting it up:\n{url}\n\n"
        f"The link stops working in {settings.INVITE_TTL_DAYS} days.",
        purpose="staff_invite",
    )

    return InviteOut(
        id=invite_id,
        email=email,
        name=body.name.strip(),
        role=body.role,
        organisation=organisation,
        expires_at=expires_at,
        url=url,
    )


@router.get("/invites/{token}", response_model=InviteDetail)
async def read_invite(token: str, db: AsyncSession = Depends(get_db)):
    """What the set-password page needs to render. Public by necessity."""
    row = await _load_open_invite(db, token)
    organisation = await _organisation_name(
        db, row.role, row.college_id, row.coaching_centre_id
    )
    return InviteDetail(
        email=row.email,
        name=row.name,
        role=row.role,
        organisation=organisation or "",
    )


@router.post("/invites/{token}/accept", response_model=TokenOut, status_code=201)
@limited("5/minute")
async def accept_invite(
    request: Request,
    token: str,
    body: InviteAcceptIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Turn an invite into a working account.

    The invite row is locked for the duration, so two people opening the same
    link at once cannot both create an account from it. The credential, the
    staff row and the used_at stamp are one transaction: an invite marked used
    with no account behind it strands somebody with no way in and no link left
    to retry with.
    """
    row = await _load_open_invite(db, token, lock=True)
    table, scope_column = STAFF_TABLE[row.role]
    scope_id = row.college_id if row.role == "college" else row.coaching_centre_id

    try:
        uid = await _insert_credential(
            db,
            email=row.email,
            password=body.password,
            role=row.role,
            college_id=row.college_id,
            coaching_centre_id=row.coaching_centre_id,
        )
        # Table and column come from STAFF_TABLE, never from the request, so
        # the f-string cannot be steered by anything a caller sends.
        await db.execute(
            text(
                f"""
                INSERT INTO {table} (id, firebase_uid, {scope_column}, name, email)
                VALUES (:id, :uid, :scope_id, :name, :email)
                """
            ),
            {
                "id": uuid.uuid4(),
                "uid": uid,
                "scope_id": scope_id,
                "name": row.name,
                "email": row.email,
            },
        )
        await db.execute(
            text("UPDATE auth_invites SET used_at = now() WHERE id = :id"),
            {"id": row.id},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="That email already has an account")

    logger.info("invite accepted role=%s uid=%s", row.role, uid)
    return _issue(await _credential_by_uid(db, uid))
