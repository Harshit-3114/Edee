"""
Session tokens for the local password path.

Firebase mints session cookies. Without a service account it cannot, and the
password path still needs a credential the browser can hold and this API can
verify on the next request. This mints one:

    edee1.<base64url payload>.<base64url hmac-sha256>

Deliberately not a JWT. We are both the only issuer and the only verifier, so
the format has to be unambiguous and nothing more. PyJWT would add a
dependency and, more to the point, an `alg` header - the field behind the
algorithm-confusion bugs that keep recurring in JWT libraries. There is no
algorithm to confuse here: HMAC-SHA256 or the token is rejected.

The payload is signed, not encrypted. It is readable by anyone holding the
token, which is fine: it carries the same claims the holder's own session
already grants them. What it cannot be is *edited* - that is what the
signature is for.
"""
import base64
import hmac
import json
import logging
import time
from hashlib import sha256
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIX = "edee1"

# A development fallback so local sessions survive a server restart without
# anyone having to invent a secret first. Staging and production refuse to
# boot without a real AUTH_SECRET (see app.main), so this value can never be
# the one signing a deployed session.
_DEV_SECRET = "edee-development-only-this-is-not-a-secret"

_warned = False


def is_local_token(value: str) -> bool:
    """Cheap shape check, so the caller can route without trying to verify."""
    return value.startswith(PREFIX + ".")


def _secret() -> bytes:
    global _warned
    if settings.AUTH_SECRET:
        return settings.AUTH_SECRET.encode("utf-8")
    if settings.ENVIRONMENT.lower() in {"staging", "production", "prod"}:
        # Unreachable in practice: the lifespan check refuses to boot first.
        # Kept as a second line so a stray import path cannot sign a
        # production token with a public constant.
        raise RuntimeError("AUTH_SECRET is required outside development")
    if not _warned:
        logger.warning(
            "AUTH_SECRET is not set. Signing local sessions with the public "
            "development constant - never do this outside a laptop."
        )
        _warned = True
    return _DEV_SECRET.encode("utf-8")


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    # urlsafe_b64decode insists on the padding the encoder above strips.
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(_secret(), payload.encode("ascii"), sha256).digest())


def mint(
    uid: str,
    role: str,
    token_version: int,
    email: Optional[str] = None,
    college_id: Optional[str] = None,
    coaching_centre_id: Optional[str] = None,
    ttl_seconds: Optional[int] = None,
) -> str:
    """
    Issue a token for an account that has just proved who it is.

    `email` is carried for the benefit of the account menu, which otherwise
    has nothing to show for a session with no Firebase user behind it. It is
    the holder's own address, so putting it in a payload only they can read
    gives nothing away. Nothing authorises off it - the backend reads identity
    from `uid`.
    """
    now = int(time.time())
    ttl = ttl_seconds if ttl_seconds is not None else settings.SESSION_MAX_AGE_SECONDS
    claims: dict[str, Any] = {
        "uid": uid,
        "role": role,
        "tv": token_version,
        "iat": now,
        "exp": now + ttl,
    }
    if email:
        claims["email"] = email
    if college_id:
        claims["college_id"] = str(college_id)
    if coaching_centre_id:
        claims["coaching_centre_id"] = str(coaching_centre_id)

    # sort_keys and the tight separators keep the encoding deterministic, so a
    # token signed by one worker verifies byte-identically on another.
    payload = _b64(
        json.dumps(claims, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    return f"{PREFIX}.{payload}.{_sign(payload)}"


def verify(token: str) -> Optional[dict]:
    """
    Claims from a token we signed and that has not expired, else None.

    None for every kind of failure on purpose. The caller turns that into one
    generic 401; telling a caller *why* their forged token was rejected is
    free help for the next attempt.
    """
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != PREFIX:
        return None

    _, payload, signature = parts

    # compare_digest, not ==: a plain comparison returns early on the first
    # differing byte, which leaks the correct prefix a byte at a time.
    if not hmac.compare_digest(signature, _sign(payload)):
        return None

    try:
        claims = json.loads(_unb64(payload))
    except (ValueError, TypeError):
        return None
    if not isinstance(claims, dict):
        return None

    exp = claims.get("exp")
    if not isinstance(exp, int) or exp <= int(time.time()):
        return None
    if not claims.get("uid") or not claims.get("role"):
        return None

    return claims
