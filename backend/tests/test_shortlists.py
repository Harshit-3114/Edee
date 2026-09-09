from httpx import AsyncClient


class TestShortlists:
    async def test_get_shortlist_empty(self, client: AsyncClient, a_student):
        response = await client.get("/shortlists/")
        assert response.status_code == 200
        assert response.json() == []

    async def test_add_to_shortlist(self, client: AsyncClient, a_student, seed_college):
        response = await client.post("/shortlists/", json=seed_college)
        assert response.status_code == 201

        listing = await client.get("/shortlists/")
        entries = listing.json()
        assert len(entries) == 1
        assert entries[0]["college_name"] == "Fergusson College"
        assert entries[0]["course_name"] == "B.Sc Statistics"
        # `id`, not `shortlist_id`: create-order takes these back as
        # shortlist_ids, and the client keys its list on them.
        assert "id" in entries[0]
        assert "created_at" in entries[0]

    async def test_fees_are_returned_in_paise(
        self, client: AsyncClient, a_student, seed_college
    ):
        """
        The column holds 1500 rupees. Every response carries paise, so the API,
        the checkout and Razorpay all speak one unit. Getting this wrong shows a
        student a fee 100x off on the screen where they hand over money.
        """
        await client.post("/shortlists/", json=seed_college)
        entries = (await client.get("/shortlists/")).json()
        assert entries[0]["application_fee"] == 150000

    async def test_adding_the_same_course_twice_is_a_conflict(
        self, client: AsyncClient, a_student, seed_college
    ):
        assert (await client.post("/shortlists/", json=seed_college)).status_code == 201
        assert (await client.post("/shortlists/", json=seed_college)).status_code == 409

    async def test_a_course_must_belong_to_the_college_claimed(
        self, client: AsyncClient, a_student, seed_college
    ):
        """
        Pairing any course id with any college id used to create a row no page
        could render and no order could price.
        """
        response = await client.post(
            "/shortlists/",
            json={
                "college_id": "00000000-0000-0000-0000-000000000009",
                "course_id": seed_college["course_id"],
            },
        )
        assert response.status_code == 404

    async def test_remove_from_shortlist(
        self, client: AsyncClient, a_student, seed_college
    ):
        await client.post("/shortlists/", json=seed_college)
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]

        assert (await client.delete(f"/shortlists/{entry_id}")).status_code == 204
        assert (await client.get("/shortlists/")).json() == []

    async def test_removing_something_that_is_not_yours_is_a_404(
        self, client: AsyncClient, auth_as, a_student, seed_college
    ):
        """
        The ownership check lives in the WHERE clause. Deleting by id alone
        would let any student remove any other student's shortlist entry.
        """
        await client.post("/shortlists/", json=seed_college)
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]

        auth_as("uid-other-student", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Other Student",
                "email": "other@example.com",
                "phone": "9876599999",
                "stream": "UG",
            },
        )
        assert (await client.delete(f"/shortlists/{entry_id}")).status_code == 404

        # And the original entry is still there.
        auth_as(a_student, role="student")
        assert len((await client.get("/shortlists/")).json()) == 1

    async def test_removing_an_unknown_id_is_a_404(self, client: AsyncClient, a_student):
        response = await client.delete("/shortlists/00000000-0000-0000-0000-000000000001")
        assert response.status_code == 404
