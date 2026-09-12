"""
Security regressions.

These run without a database: they cover the guards and the crypto, which is
where the expensive mistakes were. The role matrix is the executable form of
the access table in the dev guide - every 403 assertion here is a portal
boundary somebody could otherwise walk through.
"""
import os
import hmac
import hashlib
import json
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://dev:dev@localhost:5432/x")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", "./nonexistent.json")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_key")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "test_secret")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "webhook_secret")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db.connection import get_db  # noqa: E402
from app.middleware.auth import get_current_user  # noqa: E402
from app.routers.college_portal import NEXT_STATUS  # noqa: E402
from app.services.razorpay import (  # noqa: E402
    verify_payment_signature,
    verify_webhook_signature,
)


class _StubSession:
    """Stands in for a database. Reaching it means a guard did not fire."""

    async def execute(self, *args, **kwargs):
        raise AssertionError("A guarded endpoint reached the database")

    async def commit(self):
        raise AssertionError("A guarded endpoint reached the database")

    async def rollback(self):
        pass


async def _stub_db():
    yield _StubSession()


def client_as(role, **extra):
    claims = {"uid": f"uid-{role}", "role": role, **extra}
    app.dependency_overrides[get_current_user] = lambda: claims
    app.dependency_overrides[get_db] = _stub_db
    # raise_server_exceptions=False so the stub's "you reached the database"
    # comes back as a 500 response rather than blowing up the test. Reaching
    # the database is the *pass* condition for an allowed role.
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------
# Cross-portal isolation
# --------------------------------------------------------------------------

COLLEGE_ID = "11111111-1111-1111-1111-111111111111"
CENTRE_ID = "22222222-2222-2222-2222-222222222222"

# (method, path, the roles allowed through). Everything else must get a 403.
MATRIX = [
    ("GET", "/shortlists/", {"student"}),
    ("POST", "/shortlists/", {"student"}),
    ("POST", "/payments/create-order", {"student"}),
    ("POST", "/payments/quote", {"student"}),
    ("GET", "/students/me", {"student"}),
    ("GET", "/students/me/applications", {"student"}),
    ("GET", "/college/courses", {"college"}),
    ("POST", "/college/courses", {"college"}),
    ("GET", "/college/applications", {"college"}),
    ("GET", "/college/dashboard", {"college"}),
    ("GET", "/coaching/students", {"coaching"}),
    ("GET", "/coaching/invites", {"coaching"}),
    ("POST", "/coaching/invites", {"coaching"}),
    ("GET", "/admin/users", {"admin"}),
    ("POST", "/admin/users", {"admin"}),
    ("GET", "/admin/audit", {"admin"}),
    ("GET", "/admin/payments", {"admin"}),
    ("GET", "/admin/students", {"admin"}),
    ("GET", "/admin/system", {"admin"}),
]


@pytest.mark.parametrize("method,path,allowed", MATRIX)
@pytest.mark.parametrize("role", ["student", "college", "coaching", "admin"])
def test_role_isolation(method, path, allowed, role):
    client = client_as(role, college_id=COLLEGE_ID, coaching_centre_id=CENTRE_ID)
    res = client.request(method, path, json={})

    if role in allowed:
        # May 422 on validation or 500 on the stub database, but never 403.
        assert res.status_code != 403, f"{role} should reach {path}"
    else:
        assert res.status_code == 403, (
            f"{role} must not reach {path} (got {res.status_code})"
        )


def test_no_role_claim_is_rejected():
    """A signed-in Firebase user with no role is not a student."""
    app.dependency_overrides[get_current_user] = lambda: {"uid": "uid-nobody"}
    app.dependency_overrides[get_db] = _stub_db
    res = TestClient(app, raise_server_exceptions=False).get("/shortlists/")
    assert res.status_code == 403


def test_forged_role_is_rejected():
    """A claim inventing a fifth role does not open any portal."""
    client = client_as("superuser")
    for path in ("/admin/users", "/college/courses", "/coaching/students", "/shortlists/"):
        assert client.get(path).status_code == 403, path


def test_college_without_a_college_claim_is_refused():
    """
    A college role with no college_id passes require_roles and would then run
    scoped queries with a null scope. The dependency stops it first.
    """
    client = client_as("college")  # no college_id
    assert client.get("/college/courses").status_code == 403


def test_coaching_without_a_centre_claim_is_refused():
    client = client_as("coaching")  # no coaching_centre_id
    assert client.get("/coaching/students").status_code == 403


def test_malformed_scope_claim_is_refused():
    client = client_as("college", college_id="not-a-uuid")
    assert client.get("/college/courses").status_code == 403


# --------------------------------------------------------------------------
# Webhook and payment signatures
# --------------------------------------------------------------------------


def _sign(body: bytes, secret: str = "webhook_secret") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_webhook_rejects_a_missing_signature():
    assert verify_webhook_signature(b"{}", "") is False


def test_webhook_rejects_a_wrong_signature():
    assert verify_webhook_signature(b'{"event":"payment.captured"}', "deadbeef") is False


def test_webhook_accepts_its_own_signature():
    body = json.dumps({"event": "payment.captured"}).encode()
    assert verify_webhook_signature(body, _sign(body)) is True


def test_webhook_signature_is_bound_to_the_exact_bytes():
    """
    Re-serialising the payload changes the bytes and must invalidate the HMAC.
    This is why the handler reads request.body() rather than the parsed dict.
    """
    body = json.dumps({"event": "payment.captured", "a": 1}).encode()
    signature = _sign(body)
    reserialised = json.dumps({"a": 1, "event": "payment.captured"}).encode()
    assert verify_webhook_signature(reserialised, signature) is False


def test_unsigned_webhook_is_rejected_by_the_endpoint():
    app.dependency_overrides[get_db] = _stub_db
    res = TestClient(app, raise_server_exceptions=False).post(
        "/payments/webhook", json={"event": "payment.captured"}
    )
    assert res.status_code == 400


def test_payment_signature_uses_the_key_secret_not_the_webhook_secret():
    """
    The two signatures are different secrets over different payloads. Verifying
    one with the other's helper must fail, or a webhook replay could pose as a
    browser confirmation.
    """
    order_id, payment_id = "order_abc", "pay_xyz"
    payload = f"{order_id}|{payment_id}".encode()
    correct = hmac.new(b"test_secret", payload, hashlib.sha256).hexdigest()
    wrong = hmac.new(b"webhook_secret", payload, hashlib.sha256).hexdigest()

    assert verify_payment_signature(order_id, payment_id, correct) is True
    assert verify_payment_signature(order_id, payment_id, wrong) is False


def test_payment_signature_rejects_a_swapped_order_id():
    payload = b"order_abc|pay_xyz"
    signature = hmac.new(b"test_secret", payload, hashlib.sha256).hexdigest()
    # Same signature, different order: must not verify.
    assert verify_payment_signature("order_other", "pay_xyz", signature) is False


def test_payment_signature_rejects_empty():
    assert verify_payment_signature("order_abc", "pay_xyz", "") is False


# --------------------------------------------------------------------------
# Application status transitions
# --------------------------------------------------------------------------


def test_a_college_can_never_withdraw_an_application():
    """Withdrawal is the student's decision. No path from the college portal."""
    for source, targets in NEXT_STATUS.items():
        assert "withdrawn" not in targets, source


def test_a_decision_cannot_be_reopened():
    assert NEXT_STATUS["accepted"] == set()
    assert NEXT_STATUS["rejected"] == set()
    assert NEXT_STATUS["withdrawn"] == set()


def test_review_comes_before_a_decision():
    assert NEXT_STATUS["payment_received"] == {"under_review"}
    assert NEXT_STATUS["under_review"] == {"accepted", "rejected"}


def test_every_status_has_a_transition_entry():
    for status in (
        "payment_received",
        "under_review",
        "accepted",
        "rejected",
        "withdrawn",
    ):
        assert status in NEXT_STATUS


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------


def test_cors_is_never_a_wildcard():
    """A wildcard origin with allow_credentials leaks every signed-in session."""
    from app.core.config import settings

    assert "*" not in settings.cors_origins


def test_missing_token_is_401_not_403():
    """
    401 means "sign in"; 403 means "signed in, not allowed". The frontend
    refreshes its token on 401 only, so conflating them costs a pointless
    refresh on every anonymous request.
    """
    client = TestClient(app, raise_server_exceptions=False)
    for path in ("/admin/users", "/college/courses", "/shortlists/"):
        res = client.get(path)
        assert res.status_code == 401, f"{path} gave {res.status_code}"
        assert res.headers.get("WWW-Authenticate") == "Bearer"


def test_landing_lookup_is_public_to_everyone():
    """
    The college landing page is top-of-funnel: it must answer for every role
    and for no token at all, never with 401/403. (Unknown slugs 404, which is
    also not an auth failure.)
    """
    for role in ("student", "college", "coaching", "admin"):
        client = client_as(role, college_id=COLLEGE_ID, coaching_centre_id=CENTRE_ID)
        # Reaching the stub database (a 500 here) proves the point: no auth
        # gate fired. A guard failure would be 401 or 403.
        assert client.get("/colleges/by-slug/nowhere").status_code not in (
            401,
            403,
        ), role

    # No token at all. The stub database raises if reached, which surfaces as
    # a 500 here — the assertion that matters is "not 401": no login required.
    bare = TestClient(app, raise_server_exceptions=False)
    assert bare.get("/colleges/by-slug/nowhere").status_code != 401


def test_health_needs_no_token():
    assert TestClient(app).get("/health").status_code == 200


def test_responses_carry_a_request_id():
    """Every response carries X-Request-ID so a user report maps to one grep."""
    res = TestClient(app, raise_server_exceptions=False).get("/health")
    assert res.headers.get("x-request-id")


# --------------------------------------------------------------------------
# Rate limiting
# --------------------------------------------------------------------------


def test_rate_limiter_returns_429_once_the_budget_is_spent():
    """
    The `limited()` helper is a no-op under pytest (see app/core/rate_limit.py),
    so this exercises a throwaway app with a real limiter instead. It pins the
    slowapi/Starlette contract: if a library upgrade changes how limits attach
    to routes, this fails loudly rather than silently unprotecting signup and
    order creation in production.
    """
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from slowapi import Limiter
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    probe_limiter = Limiter(key_func=get_remote_address)
    probe = FastAPI()
    probe.state.limiter = probe_limiter

    async def too_many(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=429, content={"detail": "slow down"})

    probe.add_exception_handler(RateLimitExceeded, too_many)

    @probe.get("/probe")
    @probe_limiter.limit("2/minute")
    async def _probe(request: Request):
        return {"ok": True}

    client = TestClient(probe, raise_server_exceptions=False)
    assert client.get("/probe").status_code == 200
    assert client.get("/probe").status_code == 200
    limited = client.get("/probe")
    assert limited.status_code == 429
    assert limited.json() == {"detail": "slow down"}
