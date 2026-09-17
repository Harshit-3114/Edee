"""
Dev mode: local development without Firebase.

Dev mode exists so a developer with no service account can still run the
whole site: any well-formed dev: token works, no Firebase project needed.
The safety property under test throughout is that dev mode can only ever
switch on for ENVIRONMENT=development without credentials. Test, staging
and production always verify for real.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app, lifespan
from app.core import devmode
from app.core.config import settings
from app.db.connection import get_db
from app.services.firebase import assign_role


class _StubSession:
    async def execute(self, *args, **kwargs):
        raise AssertionError("reached the database")

    async def commit(self):
        raise AssertionError("reached the database")

    async def rollback(self):
        pass


async def _stub_db():
    yield _StubSession()


class TestParseDevToken:
    def test_student_and_admin_need_no_scope(self):
        student = devmode.parse_dev_token("dev:student")
        assert student is not None and student["role"] == "student"
        alice = devmode.parse_dev_token("dev:student:alice")
        assert alice is not None and alice["uid"] == "dev:student:alice"
        admin = devmode.parse_dev_token("dev:admin")
        assert admin is not None and admin["role"] == "admin"

    def test_staff_roles_need_a_scope(self):
        college = devmode.parse_dev_token("dev:college:11111111-1111-1111-1111-111111111111")
        assert (
            college is not None
            and college["college_id"] == "11111111-1111-1111-1111-111111111111"
        )
        assert devmode.parse_dev_token("dev:college") is None
        assert devmode.parse_dev_token("dev:coaching") is None

    def test_anything_else_is_not_a_dev_token(self):
        assert devmode.parse_dev_token("bogus") is None
        assert devmode.parse_dev_token("dev:superuser") is None
        assert devmode.parse_dev_token("dev:") is None
        assert devmode.parse_dev_token("") is None


class TestDevModeGate:
    def test_off_in_test_env(self):
        assert devmode.is_dev_mode() is False

    def test_on_for_development_without_credentials(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(devmode, "firebase_available", lambda: False)
        # Re-read through the module so the test does not depend on import style.
        import app.core.devmode as dm

        assert dm.is_dev_mode() is True

    def test_never_on_with_credentials(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(devmode, "firebase_available", lambda: True)
        import app.core.devmode as dm

        assert dm.is_dev_mode() is False

    def test_flag_forces_dev_mode_despite_credentials(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(settings, "DEV_MODE", True)
        monkeypatch.setattr(devmode, "firebase_available", lambda: True)
        import app.core.devmode as dm

        assert dm.is_dev_mode() is True

    def test_flag_off_forces_dev_mode_off_without_credentials(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(settings, "DEV_MODE", False)
        monkeypatch.setattr(devmode, "firebase_available", lambda: False)
        import app.core.devmode as dm

        assert dm.is_dev_mode() is False

    def test_flag_is_dead_outside_development(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "DEV_MODE", True)
        monkeypatch.setattr(devmode, "firebase_available", lambda: False)
        import app.core.devmode as dm

        assert dm.is_dev_mode() is False

    @pytest.mark.parametrize("env", ["staging", "production", "prod", "test"])
    def test_never_on_outside_development(self, monkeypatch, env):
        monkeypatch.setattr(settings, "ENVIRONMENT", env)
        monkeypatch.setattr(devmode, "firebase_available", lambda: False)
        import app.core.devmode as dm

        assert dm.is_dev_mode() is False


class TestDevTokensAtTheGate:
    def _request(self, monkeypatch, token):
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(devmode, "firebase_available", lambda: False)
        app.dependency_overrides[get_db] = _stub_db
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            return TestClient(app, raise_server_exceptions=False).get(
                "/shortlists/", headers=headers
            )
        finally:
            app.dependency_overrides.clear()

    def test_dev_token_reaches_past_auth(self, monkeypatch):
        # The stub database raises on access; a 500 here proves the guard
        # passed and only the database is missing.
        res = self._request(monkeypatch, "dev:student")
        assert res.status_code == 500

    def test_bogus_token_is_rejected_in_dev_mode(self, monkeypatch):
        res = self._request(monkeypatch, "bogus-token")
        assert res.status_code == 401

    def test_real_token_is_rejected_in_dev_mode(self, monkeypatch):
        res = self._request(monkeypatch, "eyJhbGciOiJSUzI1NiJ9.bogus.sig")
        assert res.status_code == 401

    def test_dev_tokens_are_rejected_outside_dev_mode(self):
        # Default test env has dev mode off: a dev: token must not verify.
        app.dependency_overrides[get_db] = _stub_db
        try:
            res = TestClient(app, raise_server_exceptions=False).get(
                "/shortlists/", headers={"Authorization": "Bearer dev:student"}
            )
            assert res.status_code == 401
        finally:
            app.dependency_overrides.clear()

    def test_missing_token_is_still_401_in_dev_mode(self, monkeypatch):
        res = self._request(monkeypatch, None)
        assert res.status_code == 401


class TestDevRoleAssignment:
    def test_assign_role_is_a_no_op_in_dev_mode(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(devmode, "firebase_available", lambda: False)
        assert assign_role("anyone", "student") is None


class TestBootRefusal:
    async def test_staging_without_firebase_refuses_to_boot(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
        monkeypatch.setattr("app.main.firebase_available", lambda: False)
        with pytest.raises(RuntimeError, match="refusing to boot"):
            await lifespan(app).__aenter__()

    async def test_production_without_firebase_refuses_to_boot(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr("app.main.firebase_available", lambda: False)
        with pytest.raises(RuntimeError, match="refusing to boot"):
            await lifespan(app).__aenter__()

    async def test_flag_in_production_refuses_to_boot(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "DEV_MODE", True)
        monkeypatch.setattr("app.main.firebase_available", lambda: True)
        with pytest.raises(RuntimeError, match="DEV_MODE"):
            await lifespan(app).__aenter__()


class TestDevDirectory:
    def test_directory_is_404_outside_dev_mode(self):
        app.dependency_overrides[get_db] = _stub_db
        try:
            res = TestClient(app, raise_server_exceptions=False).get("/dev/directory")
            assert res.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_directory_lists_orgs_in_dev_mode(
        self, client, auth_as, db_session, monkeypatch
    ):
        import uuid

        monkeypatch.setattr("app.routers.dev.devmode.is_dev_mode", lambda: True)
        college_id, centre_id = uuid.uuid4(), uuid.uuid4()
        await db_session.execute(
            text(
                "INSERT INTO colleges (id, name, slug, location, city, state, type, active)"
                " VALUES (:id, 'Dir College', 'dir-college', 'L', 'Pune', 'MH', 'private', true)"
            ),
            {"id": college_id},
        )
        await db_session.execute(
            text(
                "INSERT INTO coaching_centers (id, name, city, state, active)"
                " VALUES (:id, 'Dir Centre', 'Pune', 'MH', true)"
            ),
            {"id": centre_id},
        )
        await db_session.commit()

        auth_as("uid-dir-admin", role="admin")
        res = await client.get("/dev/directory")
        assert res.status_code == 200
        body = res.json()
        assert [c["slug"] for c in body["colleges"]] == ["dir-college"]
        assert [c["name"] for c in body["coaching_centres"]] == ["Dir Centre"]
