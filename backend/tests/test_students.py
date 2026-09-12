from httpx import AsyncClient
from sqlalchemy import text
import uuid


class TestStudents:
    async def test_create_student(self, client: AsyncClient, auth_as):
        auth_as("uid-create", role="student")
        response = await client.post(
            "/students/",
            json={
                "name": "Ananya Deshmukh",
                "email": "ananya.d@example.com",
                "phone": "9876543210",
                "stream": "UG",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Ananya Deshmukh"
        assert data["stream"] == "UG"
        assert "id" in data

    async def test_create_student_duplicate(self, client: AsyncClient, auth_as):
        auth_as("uid-duplicate", role="student")
        payload = {
            "name": "Rahul Kanade",
            "email": "rahul.k@example.com",
            "phone": "9876543211",
            "stream": "PG",
        }
        assert (await client.post("/students/", json=payload)).status_code == 201
        assert (await client.post("/students/", json=payload)).status_code == 409

    async def test_a_second_account_cannot_claim_the_same_phone(
        self, client: AsyncClient, auth_as
    ):
        auth_as("uid-phone-a", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Meera Iyer",
                "email": "meera@example.com",
                "phone": "9876500001",
                "stream": "UG",
            },
        )
        auth_as("uid-phone-b", role="student")  # different Firebase account
        response = await client.post(
            "/students/",
            json={
                "name": "Someone Else",
                "email": "else@example.com",
                "phone": "9876500001",
                "stream": "UG",
            },
        )
        assert response.status_code == 409

    async def test_staff_cannot_create_a_student_profile(
        self, client: AsyncClient, auth_as
    ):
        """A college admin must not be able to grow a second identity."""
        auth_as("uid-college-staff", role="college", college_id="x")
        response = await client.post(
            "/students/",
            json={
                "name": "Sneaky Admin",
                "email": "sneaky@example.com",
                "phone": "9876500002",
                "stream": "UG",
            },
        )
        assert response.status_code == 403

    async def test_email_comes_from_the_token_not_the_body(
        self, client: AsyncClient, auth_as
    ):
        """
        When the token carries a verified email, that is the identity stored.
        Trusting the body lets anyone register under someone else's address.
        """
        auth_as("uid-verified", role="student", email="verified@example.com")
        await client.post(
            "/students/",
            json={
                "name": "Verified Person",
                "email": "attacker-chosen@example.com",
                "phone": "9876500003",
                "stream": "UG",
            },
        )
        me = await client.get("/students/me")
        assert me.status_code == 200
        assert me.json()["email"] == "verified@example.com"

    async def test_get_me(self, client: AsyncClient, auth_as):
        auth_as("uid-getme", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Kabir Shah",
                "email": "kabir@example.com",
                "phone": "9876543212",
                "stream": "UG",
            },
        )
        response = await client.get("/students/me")
        assert response.status_code == 200
        assert response.json()["name"] == "Kabir Shah"

    async def test_update_me(self, client: AsyncClient, auth_as):
        auth_as("uid-update", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Old Name",
                "email": "update@example.com",
                "phone": "9876543213",
                "stream": "UG",
            },
        )
        response = await client.patch("/students/me", json={"name": "New Name"})
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    async def test_update_me_rejects_a_bad_phone(self, client: AsyncClient, auth_as):
        auth_as("uid-badphone", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Phone Person",
                "email": "phone@example.com",
                "phone": "9876543214",
                "stream": "UG",
            },
        )
        # Indian mobiles start 6-9. A leading 1 is not a number anyone has.
        assert (
            await client.patch("/students/me", json={"phone": "1234567890"})
        ).status_code == 422

    async def test_a_student_without_a_profile_gets_404(
        self, client: AsyncClient, auth_as
    ):
        auth_as("uid-no-profile", role="student")
        assert (await client.get("/students/me")).status_code == 404

    async def test_signup_redeems_a_coaching_invite(
        self, client: AsyncClient, auth_as, db_session
    ):
        """An invite code links a new student to the issuing centre."""
        centre_id = uuid.uuid4()
        await db_session.execute(
            text(
                """
                INSERT INTO coaching_centers (id, name, city, state, active)
                VALUES (:id, 'Allen', 'Kota', 'Rajasthan', true)
                """
            ),
            {"id": centre_id},
        )
        await db_session.execute(
            text(
                """
                INSERT INTO coaching_invites
                    (id, coaching_center_id, code, max_uses, uses)
                VALUES (:id, :cid, 'ABCCODE123', 5, 0)
                """
            ),
            {"id": uuid.uuid4(), "cid": centre_id},
        )
        await db_session.commit()

        auth_as("uid-invite", role="student")
        response = await client.post(
            "/students/",
            json={
                "name": "Invited Person",
                "email": "invited@example.com",
                "phone": "9876500004",
                "stream": "UG",
                "invite_code": "abccode123",
            },
        )
        assert response.status_code == 201

        link = (
            await db_session.execute(
                text(
                    "SELECT coaching_center_id FROM student_coaching_links "
                    "WHERE student_id = (SELECT id FROM students WHERE firebase_uid = 'uid-invite')"
                )
            )
        ).fetchone()
        assert link is not None
        assert str(link[0]) == str(centre_id)

    async def test_signup_rejects_an_exhausted_invite(
        self, client: AsyncClient, auth_as, db_session
    ):
        centre_id = uuid.uuid4()
        await db_session.execute(
            text(
                """
                INSERT INTO coaching_centers (id, name, city, state, active)
                VALUES (:id, 'Exhausted Centre', 'Kota', 'Rajasthan', true)
                """
            ),
            {"id": centre_id},
        )
        await db_session.execute(
            text(
                """
                INSERT INTO coaching_invites
                    (id, coaching_center_id, code, max_uses, uses)
                VALUES (:id, :cid, 'FULLCODE99', 1, 1)
                """
            ),
            {"id": uuid.uuid4(), "cid": centre_id},
        )
        await db_session.commit()

        auth_as("uid-exhausted", role="student")
        response = await client.post(
            "/students/",
            json={
                "name": "Late Person",
                "email": "late@example.com",
                "phone": "9876500005",
                "stream": "UG",
                "invite_code": "FULLCODE99",
            },
        )
        assert response.status_code == 400
