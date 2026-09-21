from httpx import AsyncClient


class TestContactMessages:
    async def test_visitor_can_write_and_admin_can_read(
        self, client: AsyncClient, auth_as
    ):
        payload = {
            "name": "Aarav Mehta",
            "email": "aarav@example.com",
            "purpose": "admissions",
            "message": "When do UG applications close for Fergusson College?",
        }
        response = await client.post("/contact/", json=payload)
        assert response.status_code == 201
        assert response.json()["id"]

        auth_as("uid-fixture-admin", role="admin")
        inbox = (await client.get("/admin/contact-messages")).json()
        assert len(inbox) == 1
        assert inbox[0]["email"] == "aarav@example.com"
        assert inbox[0]["purpose"] == "admissions"

    async def test_short_or_bad_payload_is_rejected(self, client: AsyncClient):
        assert (
            await client.post(
                "/contact/",
                json={"name": "A", "email": "nope", "purpose": "x", "message": "hi"},
            )
        ).status_code == 422

    async def test_non_admin_cannot_read_the_inbox(
        self, client: AsyncClient, auth_as
    ):
        auth_as("uid-fixture-student", role="student")
        assert (await client.get("/admin/contact-messages")).status_code == 403
