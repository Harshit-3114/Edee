"""
Role claims.

A role lives in two places and both must agree: the Firebase custom claim (fast,
rides along in the JWT) and the row in the database (durable). This module is
the only thing that writes the claim.
"""
from firebase_admin import auth as firebase_auth
from fastapi import HTTPException
from typing import Optional
import logging

from app.middleware.auth import _firebase_app

logger = logging.getLogger(__name__)

VALID_ROLES = {"student", "college", "coaching", "admin"}


def assign_role(
    firebase_uid: str,
    role: str,
    college_id: Optional[str] = None,
    coaching_centre_id: Optional[str] = None,
) -> None:
    """
    Writes the role claim onto the Firebase user.

    The client must call getIdToken(true) afterwards to pick it up; an
    unrefreshed token keeps the old claim until it expires, up to an hour.
    """
    if role not in VALID_ROLES:
        raise ValueError(f"unknown role: {role}")
    if role == "college" and not college_id:
        raise ValueError("college role requires college_id")
    if role == "coaching" and not coaching_centre_id:
        raise ValueError("coaching role requires coaching_centre_id")

    claims = {"role": role}
    if college_id:
        claims["college_id"] = str(college_id)
    if coaching_centre_id:
        claims["coaching_centre_id"] = str(coaching_centre_id)

    try:
        firebase_auth.set_custom_user_claims(firebase_uid, claims, app=_firebase_app())
    except Exception:
        logger.exception("Could not set role claim for %s", firebase_uid)
        raise HTTPException(status_code=502, detail="Could not assign the role")


def revoke_access(firebase_uid: str) -> None:
    """
    Immediate lockout. Clears the claim and revokes refresh tokens, which only
    takes effect because get_current_user verifies with check_revoked=True.
    """
    try:
        app = _firebase_app()
        firebase_auth.set_custom_user_claims(firebase_uid, {}, app=app)
        firebase_auth.revoke_refresh_tokens(firebase_uid, app=app)
    except Exception:
        logger.exception("Could not revoke access for %s", firebase_uid)
        raise HTTPException(status_code=502, detail="Could not revoke access")
