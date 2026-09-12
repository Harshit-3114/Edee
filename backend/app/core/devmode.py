"""
Development auth bypass.

When Firebase is not configured, local development and testing would be stuck
at the login screen: no tokens can be minted or verified. Dev mode closes
that gap by accepting self-described bearer tokens of the form:

    dev:student[:anything]
    dev:admin[:anything]
    dev:college:<college_id>
    dev:coaching:<coaching_centre_id>

The trailing tag is part of the identity, so `dev:student:alice` and
`dev:student:bob` are different students. Any values work — that is the
point — but the SHAPE is enforced, so a typo fails loudly instead of
silently becoming someone else.

Safety rules, all load-bearing:

1. Dev mode is ON only when Firebase is unavailable AND ENVIRONMENT is
   exactly "development". Test, staging and production never get it, so a
   `dev:` token presented anywhere else is just a 401.
2. Staging and production REFUSE TO BOOT without a service account (see the
   lifespan check in app.main), so a misconfigured deploy fails closed
   instead of running open.
3. Payments still need real Razorpay credentials. Dev mode fakes identity,
   never money: no order can be created against the gateway and no webhook
   can arrive, so nothing payable happens here.
"""
import logging
import os
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

DEV_ROLES = frozenset({"student", "college", "coaching", "admin"})


def firebase_available() -> bool:
    """True when a service-account file exists to initialise the Admin SDK."""
    path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    return bool(path) and os.path.isfile(path)


def is_dev_mode() -> bool:
    """
    Open local development.

    DEV_MODE=1 forces it on even with keys; DEV_MODE=0 forces it off even
    without them; unset auto-detects from missing credentials. Any of that
    only matters for ENVIRONMENT=development: test stays deterministic, and
    staging/production refuse to boot instead (see app.main lifespan).
    """
    env = settings.ENVIRONMENT.lower()
    if env in {"staging", "production", "prod", "test"}:
        return False
    if settings.DEV_MODE is True:
        return True
    if settings.DEV_MODE is False:
        return False
    return not firebase_available()


def parse_dev_token(token: str) -> Optional[dict]:
    """
    Parse a dev-mode bearer token into claims, or None when it is not one.

    Returned claims mirror the Firebase custom-claim shape the rest of the
    app reads (role, college_id, coaching_centre_id), so every downstream
    guard — require_roles, current_college_id, ownership WHERE clauses —
    keeps working unchanged.
    """
    if not token.startswith("dev:"):
        return None
    parts = token.split(":")
    if len(parts) < 2:
        return None
    role = parts[1]
    if role not in DEV_ROLES:
        return None
    scope = ":".join(parts[2:]) if len(parts) > 2 else ""

    claims: dict = {"uid": token, "role": role, "dev": True}
    if role == "college":
        if not scope:
            return None
        claims["college_id"] = scope
    elif role == "coaching":
        if not scope:
            return None
        claims["coaching_centre_id"] = scope
    return claims


def log_dev_mode_once() -> None:
    """Loud at boot so nobody mistakes dev mode for the real thing."""
    reason = (
        "DEV_MODE=1 forces it on"
        if settings.DEV_MODE
        else "Firebase is not configured"
    )
    logger.warning(
        "DEV MODE (%s). Accepting dev: tokens for local development only. "
        "Add real API keys for production behaviour.",
        reason,
    )
