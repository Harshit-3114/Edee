"""
Authentication and authorisation.

get_current_user answers "who is this". require_roles and the scoping
dependencies answer "what may they touch". Keep them separate: an endpoint that
calls only get_current_user is open to every signed-in account on the platform,
which is almost never what is wanted.
"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from firebase_admin import auth as firebase_auth
import firebase_admin
from firebase_admin import credentials
from uuid import UUID
import logging

from app.core import local_token
from app.core.config import settings
from app.core.devmode import is_dev_mode, parse_dev_token
from app.db.connection import get_db

logger = logging.getLogger(__name__)

_app = None


def _firebase_app():
    """
    Initialise the Admin SDK on first use, not at import.

    Doing it at module scope means the service-account JSON has to exist before
    anything can even import the app - so no test run, no `--help`, no CI
    syntax check without shipping a production credential around.
    """
    global _app
    if _app is None:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        try:
            _app = firebase_admin.initialize_app(cred)
        except ValueError:
            # Already initialised elsewhere in this process (tests, workers).
            _app = firebase_admin.get_app()
    return _app


# auto_error=False so a *missing* Authorization header becomes a 401 rather
# than Starlette's default 403. The distinction is not pedantic: a client reads
# 401 as "sign in again" and 403 as "you are signed in, but not allowed here",
# and the frontend refreshes its token on one and not the other.
bearer = HTTPBearer(auto_error=False)

VALID_ROLES = {"student", "college", "coaching", "admin"}

# Header the Next.js server uses to present a session cookie it holds for the
# user. Deliberately a header and not a cookie on this origin: a browser will
# never attach it by itself, so no cross-site page can ride an ambient
# credential into this API. Only a server that already holds the cookie can
# send it, which is what makes this path CSRF-free by construction rather than
# by a token check we would have to keep correct.
SESSION_HEADER = "X-Session-Cookie"


async def _verify_local_token(token: str, db: AsyncSession) -> dict:
    """
    Verify a session token minted by the local email/password path.

    Two steps, and both are needed. The signature proves we issued it and that
    nobody has edited the claims. The row lookup proves the account still
    exists, is still active, and has not had its sessions revoked since -
    which is the same guarantee check_revoked=True buys on the Firebase path,
    for one indexed SELECT instead of a network round trip.

    Role and scope come from the row, not from the token. An admin who moves
    somebody between colleges, or strips a role, should not have to wait out
    an eight-hour token for it to mean anything.
    """
    claims = local_token.verify(token)
    if claims is None:
        raise HTTPException(
            status_code=401,
            detail="Session expired, sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )

    row = (
        await db.execute(
            text(
                """
                SELECT role, college_id, coaching_centre_id, active, token_version
                FROM auth_credentials
                WHERE uid = :uid
                """
            ),
            {"uid": claims["uid"]},
        )
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Session is no longer valid")
    if not row.active:
        raise HTTPException(status_code=403, detail="This account is disabled")
    if int(claims.get("tv", -1)) != int(row.token_version):
        raise HTTPException(status_code=401, detail="Session revoked, sign in again")

    return {
        "uid": claims["uid"],
        "role": row.role,
        "college_id": str(row.college_id) if row.college_id else None,
        "coaching_centre_id": (
            str(row.coaching_centre_id) if row.coaching_centre_id else None
        ),
        # Lets the /auth endpoints tell a local session from a Firebase one
        # without re-parsing the credential.
        "local": True,
    }


def _verify_session_cookie(cookie: str) -> dict:
    """Verify a session cookie minted by POST /auth/session."""
    if is_dev_mode():
        claims = parse_dev_token(cookie)
        if claims is not None:
            return claims
        raise HTTPException(status_code=401, detail="Invalid dev session")

    try:
        return firebase_auth.verify_session_cookie(
            cookie, check_revoked=True, app=_firebase_app()
        )
    except firebase_auth.ExpiredSessionCookieError:
        raise HTTPException(status_code=401, detail="Session expired, sign in again")
    except firebase_auth.RevokedSessionCookieError:
        raise HTTPException(status_code=401, detail="Session revoked, sign in again")
    except firebase_auth.UserDisabledError:
        raise HTTPException(status_code=403, detail="This account is disabled")
    except firebase_auth.InvalidSessionCookieError:
        raise HTTPException(status_code=401, detail="Invalid session")
    except Exception:
        # Same reasoning as the ID-token path: the underlying error separates
        # "malformed" from "wrong project", which is free reconnaissance.
        logger.exception("Session cookie verification failed")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Answers "who is this" from any credential the platform issues.

    Two ways a credential arrives:

      Authorization: Bearer <credential>  the browser, calling directly
      X-Session-Cookie: <credential>      the Next.js server, rendering a page

    and three kinds of credential it may be: a token from the local
    email/password path, a dev: token, or a Firebase ID token or session
    cookie. The local one is tried first because it is the cheapest to reject
    - a prefix check, then an HMAC - and because it is the path that works
    while no Firebase service account is configured.

    Whichever path answers, the returned claims have the same shape, so every
    guard downstream stays indifferent to how somebody signed in.

    check_revoked=True is not optional on the Firebase branches. Without it,
    revoking a compromised account's refresh tokens does nothing until the
    credential expires by itself, leaving an attacker up to an hour of
    continued access. It costs one lookup. The local branch buys the same
    guarantee with token_version.
    """
    session_cookie = request.headers.get(SESSION_HEADER)
    if session_cookie:
        if local_token.is_local_token(session_cookie):
            return await _verify_local_token(session_cookie, db)
        return _verify_session_cookie(session_cookie)

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # The local email/password path. Available in every environment: it is a
    # real sign-in method, not a bypass, and it is the only one that works
    # while no Firebase service account is configured.
    if local_token.is_local_token(token):
        return await _verify_local_token(token, db)

    # Dev mode (local development without Firebase only): accept
    # self-described dev: tokens. Anything else is rejected here, before it
    # can reach the real verifier.
    if is_dev_mode():
        claims = parse_dev_token(token)
        if claims is not None:
            return claims
        raise HTTPException(
            status_code=401,
            detail="Dev mode: sign in with a dev: token (e.g. dev:student)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return firebase_auth.verify_id_token(
            credentials.credentials, check_revoked=True, app=_firebase_app()
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token revoked, sign in again")
    except firebase_auth.UserDisabledError:
        raise HTTPException(status_code=403, detail="This account is disabled")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        # Never hand the underlying error back: it distinguishes "malformed
        # token" from "wrong project", which is free reconnaissance.
        logger.exception("Token verification failed")
        raise HTTPException(status_code=401, detail="Authentication failed")


def require_roles(*roles: str):
    """
    Restrict an endpoint to one or more roles.

        Depends(require_roles("college", "admin"))
    """
    unknown = set(roles) - VALID_ROLES
    if unknown:
        raise ValueError(f"unknown role(s): {sorted(unknown)}")

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _check


# Kept so existing imports keep working. require_roles is the one to reach for.
def require_role(role: str):
    return require_roles(role)


def require_any_role(*roles: str):
    return require_roles(*roles)


async def current_college_id(
    user: dict = Depends(require_roles("college")),
) -> UUID:
    """
    The college this staff member may act on.

    Always take the scope from the verified token, never from a path or body
    parameter. That is the whole difference between "this college's applicants"
    and "any applicant whose id you can guess".
    """
    raw = user.get("college_id")
    if not raw:
        raise HTTPException(status_code=403, detail="No college bound to this account")
    try:
        return UUID(str(raw))
    except (ValueError, TypeError):
        raise HTTPException(status_code=403, detail="Malformed college claim")


async def current_coaching_centre_id(
    user: dict = Depends(require_roles("coaching")),
) -> UUID:
    raw = user.get("coaching_centre_id")
    if not raw:
        raise HTTPException(
            status_code=403, detail="No coaching centre bound to this account"
        )
    try:
        return UUID(str(raw))
    except (ValueError, TypeError):
        raise HTTPException(status_code=403, detail="Malformed coaching claim")


def client_ip(request: Request) -> str:
    """Best-effort client address, for rate limiting and audit rows."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
