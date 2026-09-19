import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text


@pytest_asyncio.fixture
async def two_notifications(db_session):
    """Two unread notifications for the default test student."""
    await db_session.execute(
        text(
            """
            INSERT INTO notifications
                (id, recipient_uid, role, type, title, body, link)
            VALUES (:a, 'uid-fixture-student', 'student', 'application_status',
                    'Update on your application for B.Sc Statistics at Fergusson College',
                    NULL, '/student/dashboard'),
                    (:b, 'uid-someone-else', 'student', 'application_status',
                    'Not yours', NULL, '/student/dashboard')
            """
        ),
        {"a": uuid.uuid4(), "b": uuid.uuid4()},
    )
    await db_session.commit()


@pytest_asyncio.fixture
async def paid_application(db_session, seed_college):
    """A student, a course, and a paid application between them."""
    student_id, application_id = uuid.uuid4(), uuid.uuid4()
    await db_session.execute(
        text(
            """
            INSERT INTO students (id, firebase_uid, name, email, phone, stream)
            VALUES (:sid, 'uid-fixture-student', 'Ananya Deshmukh',
                    'ananya@example.com', '9876543210', 'UG')
            """
        ),
        {"sid": student_id},
    )
    await db_session.execute(
        text(
            """
            INSERT INTO applications
                (id, student_id, college_id, course_id, status)
            VALUES (:aid, :sid, :cid, :course, 'payment_received')
            """
        ),
        {
            "aid": application_id,
            "sid": student_id,
            "cid": seed_college["college_id"],
            "course": seed_college["course_id"],
        },
    )
    await db_session.execute(
        text(
            """
            INSERT INTO college_admins
                (id, firebase_uid, college_id, name, email, active)
            VALUES (:id, 'uid-fixture-admin', :cid, 'College Admin',
                    'admin@example.com', true)
            """
        ),
        {"id": uuid.uuid4(), "cid": seed_college["college_id"]},
    )
    await db_session.commit()
    return {"application_id": str(application_id)}


class TestNotifications:
    async def test_list_shows_only_mine_with_unread_count(
        self, client: AsyncClient, auth_as, two_notifications
    ):
        auth_as("uid-fixture-student", role="student")
        data = (await client.get("/notifications/")).json()
        assert data["unread_count"] == 1
        assert [n["title"] for n in data["notifications"]] == [
            "Update on your application for B.Sc Statistics at Fergusson College"
        ]

    async def test_mark_read_then_read_all(
        self, client: AsyncClient, auth_as, two_notifications
    ):
        auth_as("uid-fixture-student", role="student")
        first = (await client.get("/notifications/")).json()["notifications"][0]
        assert (
            await client.patch(f"/notifications/{first['id']}/read")
        ).status_code == 200
        assert (await client.get("/notifications/?unread_only=true")).json()[
            "notifications"
        ] == []
        # Somebody else's row is not ours to mark.
        others = await client.get("/notifications/")
        assert others.json()["unread_count"] == 0
        assert (await client.post("/notifications/read-all")).status_code == 200

    async def test_status_change_notifies_the_student(
        self, client: AsyncClient, auth_as, paid_application, seed_college
    ):
        auth_as(
            "uid-fixture-admin",
            role="college",
            college_id=seed_college["college_id"],
        )
        response = await client.patch(
            f"/college/applications/{paid_application['application_id']}",
            json={"status": "under_review"},
        )
        assert response.status_code == 200

        auth_as("uid-fixture-student", role="student")
        data = (await client.get("/notifications/")).json()
        assert data["unread_count"] == 1
        note = data["notifications"][0]
        assert note["type"] == "application_status"
        # The student-facing site never shows the verdict: the title names
        # the application, never the decision.
        assert note["title"] == "Update on your application for B.Sc Statistics at Fergusson College"
        assert "Under review" not in note["title"]
        assert note["link"] == "/student/dashboard"
