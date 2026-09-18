"""
Session cookie exchange, and the second way into get_current_user.

ENVIRONMENT=test, so dev mode is off here (by design - see devmode.is_dev_mode)
and these exercise the real Firebase path with the SDK stubbed. The property
under test throughout: the session path must be exactly as strict as the bearer
path it sits beside. A session credential that is malformed, expired, revoked
or absent is worth nothing, and presenting one is never a way past a role check.
"""
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from firebase_admin import auth as firebase_auth

from app.core.config import settings
from app.main import app
from app.middleware.auth import SESSION_HEADER, get_current_user, require_roles

STUDENT = {"uid": "uid-student", "role": "student"}
ADMIN = {"uid": "uid-admin", "role": "admin"}


@pytest.fixture(autouse=True)
def no_real_firebase(monkeypatch):
    """Never touch a real project, and never need a service-account file."""
    monkeypatch.setattr("app.middleware.auth._firebase_app", lambda: None)
    monkeypatch.setattr("app.routers.auth._firebase_app", lambda: None)


# A tiny app so identity can be tested without dragging the database in.
probe = FastAPI()


@probe.get("/whoami")
async def whoami(user: dict = Depends(get_current_user)):
    return {"uid": user.get("uid"), "role": user.get("role")}


@probe.get("/admin-only")
async def admin_only(user: dict = Depends(require_roles("admin"))):
    return {"ok": True}


@pytest.fixture
def probe_client():
    with TestClient(probe) as c:
        yield c


@pytest.fixture
def client():
    # No context manager on purpose: that would run the app lifespan, which
    # opens a database connection. Nothing under /auth/session touches the
    # database, so the suite stays runnable without Postgres up.
    return TestClient(app)


class TestSessionHeaderAuthenticates:
    def test_a_valid_session_identifies_the_user(self, probe_client, monkeypatch):
        monkeypatch.setattr(firebase_auth, "verify_session_cookie", lambda *a, **k: STUDENT)
        res = probe_client.get("/whoami", headers={SESSION_HEADER: "cookie-value"})
        assert res.status_code == 200
        assert res.json() == {"uid": "uid-student", "role": "student"}

    def test_revocation_is_always_checked(self, probe_client, monkeypatch):
        """
        check_revoked=True is the whole reason this is a session cookie and not
        a parked ID token. Without it, revoking a compromised account buys
        nothing until the credential expires on its own.
        """
        seen = {}

        def verify(cookie, **kwargs):
            seen.update(kwargs)
            return STUDENT

        monkeypatch.setattr(firebase_auth, "verify_session_cookie", verify)
        probe_client.get("/whoami", headers={SESSION_HEADER: "cookie-value"})
        assert seen.get("check_revoked") is True

    def test_a_bearer_token_still_works_unchanged(self, probe_client, monkeypatch):
        monkeypatch.setattr(firebase_auth, "verify_id_token", lambda *a, **k: ADMIN)
        res = probe_client.get("/whoami", headers={"Authorization": "Bearer id-token"})
        assert res.status_code == 200
        assert res.json()["role"] == "admin"

    def test_no_credential_at_all_is_401(self, probe_client):
        assert probe_client.get("/whoami").status_code == 401

    @pytest.mark.parametrize(
        "error,expected",
        [
            (firebase_auth.ExpiredSessionCookieError("expired", None), 401),
            (firebase_auth.RevokedSessionCookieError("revoked"), 401),
            (firebase_auth.InvalidSessionCookieError("invalid"), 401),
            (firebase_auth.UserDisabledError("disabled", None), 403),
            (RuntimeError("something else entirely"), 401),
        ],
    )
    def test_a_session_that_does_not_verify_is_refused(
        self, probe_client, monkeypatch, error, expected
    ):
        def boom(*a, **k):
            raise error

        monkeypatch.setattr(firebase_auth, "verify_session_cookie", boom)
        res = probe_client.get("/whoami", headers={SESSION_HEADER: "cookie-value"})
        assert res.status_code == expected

    def test_an_unexpected_error_leaks_nothing_about_why(self, probe_client, monkeypatch):
        def boom(*a, **k):
            raise RuntimeError("project mismatch: edee-prod vs edee-staging")

        monkeypatch.setattr(firebase_auth, "verify_session_cookie", boom)
        res = probe_client.get("/whoami", headers={SESSION_HEADER: "cookie-value"})
        assert "edee-prod" not in res.text and "mismatch" not in res.text

    def test_an_empty_session_header_falls_through_to_bearer(self, probe_client, monkeypatch):
        # An empty header must not short-circuit into a 401 that hides a
        # perfectly good bearer token sitting next to it.
        monkeypatch.setattr(firebase_auth, "verify_id_token", lambda *a, **k: STUDENT)
        res = probe_client.get(
            "/whoami", headers={SESSION_HEADER: "", "Authorization": "Bearer id-token"}
        )
        assert res.status_code == 200
        assert res.json()["role"] == "student"

    def test_a_session_cannot_forge_a_role_it_does_not_have(self, probe_client, monkeypatch):
        monkeypatch.setattr(firebase_auth, "verify_session_cookie", lambda *a, **k: STUDENT)
        assert probe_client.get("/admin-only", headers={SESSION_HEADER: "c"}).status_code == 403

    def test_a_session_carries_its_role_into_the_guard(self, probe_client, monkeypatch):
        monkeypatch.setattr(firebase_auth, "verify_session_cookie", lambda *a, **k: ADMIN)
        assert probe_client.get("/admin-only", headers={SESSION_HEADER: "c"}).status_code == 200

    def test_an_id_token_is_not_accepted_as_a_session(self, probe_client, monkeypatch):
        """
        The two credentials are verified by different calls and must not be
        interchangeable - a stolen ID token must not become a long-lived
        session by being moved into this header.
        """
        monkeypatch.setattr(firebase_auth, "verify_id_token", lambda *a, **k: ADMIN)

        def reject(*a, **k):
            raise firebase_auth.InvalidSessionCookieError("not a session cookie")

        monkeypatch.setattr(firebase_auth, "verify_session_cookie", reject)
        res = probe_client.get("/whoami", headers={SESSION_HEADER: "an-id-token"})
        assert res.status_code == 401


class TestCreateSession:
    def test_mints_a_cookie_for_a_verified_id_token(self, client, monkeypatch):
        monkeypatch.setattr(firebase_auth, "verify_id_token", lambda *a, **k: STUDENT)
        monkeypatch.setattr(firebase_auth, "create_session_cookie", lambda *a, **k: "minted")

        res = client.post("/auth/session", headers={"Authorization": "Bearer id-token"})
        assert res.status_code == 200
        assert res.json() == {
            "session": "minted",
            "expires_in": settings.SESSION_MAX_AGE_SECONDS,
        }

    def test_mints_for_exactly_the_configured_lifetime(self, client, monkeypatch):
        seen = {}

        def mint(token, expires_in=None, **k):
            seen["expires_in"] = expires_in
            return "minted"

        monkeypatch.setattr(firebase_auth, "verify_id_token", lambda *a, **k: STUDENT)
        monkeypatch.setattr(firebase_auth, "create_session_cookie", mint)
        client.post("/auth/session", headers={"Authorization": "Bearer id-token"})
        assert seen["expires_in"].total_seconds() == settings.SESSION_MAX_AGE_SECONDS

    def test_refuses_a_caller_with_no_credential(self, client):
        assert client.post("/auth/session").status_code == 401

    @pytest.mark.parametrize(
        "error,expected",
        [
            (firebase_auth.ExpiredIdTokenError("expired", None), 401),
            (firebase_auth.RevokedIdTokenError("revoked"), 401),
            (firebase_auth.InvalidIdTokenError("invalid"), 401),
            (firebase_auth.UserDisabledError("disabled", None), 403),
        ],
    )
    def test_a_bad_id_token_mints_nothing(self, client, monkeypatch, error, expected):
        def boom(*a, **k):
            raise error

        monkeypatch.setattr(firebase_auth, "verify_id_token", boom)
        monkeypatch.setattr(
            firebase_auth,
            "create_session_cookie",
            lambda *a, **k: pytest.fail("minted a session for a bad token"),
        )
        res = client.post("/auth/session", headers={"Authorization": "Bearer bad"})
        assert res.status_code == expected


class TestRevokeSession:
    def test_signing_out_revokes_every_session_the_account_holds(self, client, monkeypatch):
        revoked = []
        monkeypatch.setattr(firebase_auth, "verify_session_cookie", lambda *a, **k: ADMIN)
        monkeypatch.setattr(
            firebase_auth, "revoke_refresh_tokens", lambda uid, **k: revoked.append(uid)
        )
        res = client.delete("/auth/session", headers={SESSION_HEADER: "cookie-value"})
        assert res.status_code == 204
        assert revoked == ["uid-admin"]

    def test_needs_a_credential_of_its_own(self, client):
        assert client.delete("/auth/session").status_code == 401

    def test_a_failed_revoke_does_not_trap_the_user(self, client, monkeypatch):
        def boom(*a, **k):
            raise RuntimeError("firebase unreachable")

        monkeypatch.setattr(firebase_auth, "verify_session_cookie", lambda *a, **k: ADMIN)
        monkeypatch.setattr(firebase_auth, "revoke_refresh_tokens", boom)
        # The cookie is dropped regardless; sign-out must still succeed.
        assert client.delete("/auth/session", headers={SESSION_HEADER: "c"}).status_code == 204
