"""
GET /admin/system.

The endpoint deliberately avoids get_db (a down database must read as
"database: down", not as a 500), so these tests need no database at all:
helpers are stubbed, and the failure paths are exercised by pointing the
real helpers at things that fail fast.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware.auth import get_current_user
from app.services.health import ServiceStatus, check_database, summarize


def _ok(name: str, label: str) -> ServiceStatus:
    return ServiceStatus(
        name=name, label=label, status="operational", latency_ms=1, detail="ok"
    )


def _down(name: str, label: str) -> ServiceStatus:
    return ServiceStatus(
        name=name, label=label, status="down", detail="unreachable"
    )


@pytest.fixture
def admin_client(monkeypatch):
    async def fake_db():
        return _ok("database", "PostgreSQL")

    def fake_firebase():
        return _ok("firebase", "Firebase Auth")

    def fake_razorpay():
        return _ok("razorpay", "Razorpay")

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "uid-admin",
        "role": "admin",
    }
    monkeypatch.setattr("app.routers.admin.health_checks.check_database", fake_db)
    monkeypatch.setattr("app.routers.admin.health_checks.check_firebase", fake_firebase)
    monkeypatch.setattr("app.routers.admin.health_checks.check_razorpay", fake_razorpay)
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


class TestSystemEndpoint:
    def test_admin_sees_every_dependency(self, admin_client):
        res = admin_client.get("/admin/system")
        assert res.status_code == 200
        body = res.json()
        assert body["overall"] == "operational"
        assert [s["name"] for s in body["services"]] == [
            "api",
            "database",
            "firebase",
            "razorpay",
        ]
        assert body["checked_at"]

    def test_overall_is_the_worst_part(self, admin_client, monkeypatch):
        monkeypatch.setattr(
            "app.routers.admin.health_checks.check_razorpay",
            lambda: _down("razorpay", "Razorpay"),
        )
        body = admin_client.get("/admin/system").json()
        assert body["overall"] == "down"
        statuses = {s["name"]: s["status"] for s in body["services"]}
        assert statuses["razorpay"] == "down"
        assert statuses["database"] == "operational"

    def test_non_admin_is_refused(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "uid-student",
            "role": "student",
        }
        try:
            res = TestClient(app, raise_server_exceptions=False).get("/admin/system")
            assert res.status_code == 403
        finally:
            app.dependency_overrides.clear()


class TestSummarize:
    def test_all_operational(self):
        assert summarize([_ok("a", "A"), _ok("b", "B")]).overall == "operational"

    def test_degraded_outranks_operational(self):
        degraded = ServiceStatus(
            name="a", label="A", status="degraded", detail="slow"
        )
        assert summarize([_ok("b", "B"), degraded]).overall == "degraded"

    def test_down_outranks_everything(self):
        degraded = ServiceStatus(
            name="a", label="A", status="degraded", detail="slow"
        )
        assert summarize([degraded, _down("b", "B")]).overall == "down"


class TestHelpersNeverRaise:
    async def test_database_check_survives_a_dead_engine(self, monkeypatch):
        def boom():
            raise ConnectionError("no database here")

        monkeypatch.setattr("app.services.health.get_engine", boom)
        result = await check_database()
        assert result.status == "down"

    def test_firebase_check_reports_misconfiguration(self, monkeypatch):
        def boom():
            raise FileNotFoundError("no credential here")

        monkeypatch.setattr("app.middleware.auth._firebase_app", boom)
        from app.services.health import check_firebase

        assert check_firebase().status == "down"
