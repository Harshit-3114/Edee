"""
Fixtures for the database-backed suite.

Two things here were wrong before and are worth naming, because both made the
old tests silently meaningless rather than merely failing:

1. `patch("app.middleware.auth.get_current_user")` does nothing. FastAPI
   captures the dependency callable when the route is registered, so patching
   the module attribute afterwards has no effect on the running app. Every
   request went to the real Firebase verifier and came back 401 - which the old
   assertions (`status_code in [201, 404, 409]`) happily accepted. The
   supported hook is `app.dependency_overrides`.

2. `AsyncClient(app=app)` was removed in httpx 0.27; it needs an ASGITransport.

The suite skips when Postgres is unreachable, so a machine without Docker
running gets a clean skip rather than a wall of connection errors.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.database import Base

TEST_DATABASE_URL = "postgresql+asyncpg://dev:dev@localhost:5432/college_platform_test"

engine = create_async_engine(TEST_DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


# Not autouse: test_security.py runs without a database, and an autouse skip
# here would take the whole suite down with it.
@pytest_asyncio.fixture(scope="session")
async def test_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Postgres unreachable, skipping database tests: {exc}")
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_db):
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
def auth_as():
    """
    Sign the client in as a given identity.

    A setter rather than a fixed user, because the ownership checks need to
    switch identity mid-test: student A creates a shortlist, student B must not
    be able to delete it.
    """
    state = {"claims": {"uid": "test-uid", "role": "student"}}

    def _set(uid: str, role: str = "student", **claims):
        state["claims"] = {"uid": uid, "role": role, **claims}

    app.dependency_overrides[get_current_user] = lambda: state["claims"]
    yield _set
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def client(db_session, auth_as, monkeypatch):
    async def override_get_db():
        yield db_session

    # No Firebase project behind these tests, so claim assignment is a no-op.
    # The role the endpoint would have granted is supplied by auth_as instead.
    monkeypatch.setattr("app.routers.students.assign_role", lambda *a, **k: None)

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def seed_college(db_session):
    """A college with one open course, priced at 1500 rupees."""
    import uuid
    from sqlalchemy import text

    college_id, course_id = uuid.uuid4(), uuid.uuid4()
    await db_session.execute(
        text(
            """
            INSERT INTO colleges (id, name, location, city, state, type, active)
            VALUES (:id, 'Fergusson College', 'FC Road', 'Pune', 'Maharashtra',
                    'private', true)
            """
        ),
        {"id": college_id},
    )
    await db_session.execute(
        text(
            """
            INSERT INTO college_courses
                (id, college_id, course_name, stream, duration_years, seats,
                 application_fee, active)
            VALUES (:id, :cid, 'B.Sc Statistics', 'UG', 3, 60, 1500, true)
            """
        ),
        {"id": course_id, "cid": college_id},
    )
    await db_session.commit()
    return {"college_id": str(college_id), "course_id": str(course_id)}


@pytest_asyncio.fixture
async def a_student(client, auth_as):
    """A signed-up student, already authenticated."""
    auth_as("uid-fixture-student", role="student")
    await client.post(
        "/students/",
        json={
            "name": "Ananya Deshmukh",
            "email": "ananya@example.com",
            "phone": "9876543210",
            "stream": "UG",
        },
    )
    return "uid-fixture-student"
