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
"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel

from app.core.config import settings
from app.core.devmode import is_dev_mode, parse_dev_token
from app.middleware.auth import _firebase_app, get_current_user

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
async def revoke_session(user: dict = Depends(get_current_user)):
    """
    Revoke every session this account holds.

    Clearing the cookie on the Next.js side ends the session in that browser.
    This ends it everywhere, which is what a user signing out of a shared
    machine actually wants. Dev mode has nothing to revoke.
    """
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
