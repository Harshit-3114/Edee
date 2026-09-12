"""
Authentication and authorisation.

get_current_user answers "who is this". require_roles and the scoping
dependencies answer "what may they touch". Keep them separate: an endpoint that
calls only get_current_user is open to every signed-in account on the platform,
which is almost never what is wanted.
"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from firebase_admin import auth as firebase_auth
import firebase_admin
from firebase_admin import credentials
from uuid import UUID
import logging

from app.core.config import settings
from app.core.devmode import is_dev_mode, parse_dev_token

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


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    """
    Verifies the Firebase ID token on every request and returns its claims.

    check_revoked=True is not optional. Without it, revoking a compromised
    account's refresh tokens does nothing until the ID token expires by itself,
    leaving an attacker up to an hour of continued access. It costs one lookup.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

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
