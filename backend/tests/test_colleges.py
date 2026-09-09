from httpx import AsyncClient


class TestColleges:
    async def test_list_colleges(self, client: AsyncClient, a_student, seed_college):
        response = await client.get("/colleges/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == "Fergusson College"

    async def test_courses_are_nested_not_flattened(
        self, client: AsyncClient, a_student, seed_college
    ):
        """
        One object per college with its courses inside, rather than one row per
        college-course pair. The client renders a card per college.
        """
        college = (await client.get("/colleges/")).json()[0]
        assert isinstance(college["courses"], list)
        assert len(college["courses"]) == 1
        assert college["courses"][0]["course_name"] == "B.Sc Statistics"

    async def test_fees_are_returned_in_paise(
        self, client: AsyncClient, a_student, seed_college
    ):
        college = (await client.get("/colleges/")).json()[0]
        assert college["courses"][0]["application_fee"] == 150000  # 1500 rupees

    async def test_filters_narrow_the_result(
        self, client: AsyncClient, a_student, seed_college
    ):
        assert len((await client.get("/colleges/?stream=UG")).json()) == 1
        assert len((await client.get("/colleges/?stream=PG")).json()) == 0
        assert len((await client.get("/colleges/?state=Maharashtra")).json()) == 1
        assert len((await client.get("/colleges/?state=Kerala")).json()) == 0
        assert len((await client.get("/colleges/?search=Fergusson")).json()) == 1
        assert len((await client.get("/colleges/?search=Nowhere")).json()) == 0

    async def test_an_unknown_stream_is_rejected_not_ignored(
        self, client: AsyncClient, a_student
    ):
        """Literal-typed, so a junk value is a 422 rather than a silent no-op."""
        assert (await client.get("/colleges/?stream=XX")).status_code == 422

    async def test_like_wildcards_in_a_search_are_escaped(
        self, client: AsyncClient, a_student, seed_college
    ):
        """A literal % must not become "match everything"."""
        assert (await client.get("/colleges/?search=%")).json() == []

    async def test_get_college(self, client: AsyncClient, a_student, seed_college):
        response = await client.get(f"/colleges/{seed_college['college_id']}")
        assert response.status_code == 200
        assert response.json()["name"] == "Fergusson College"

    async def test_a_missing_college_is_404_not_500(
        self, client: AsyncClient, a_student
    ):
        """
        HTTPException was not imported in this router, so this path raised
        NameError and returned a 500 with a traceback.
        """
        response = await client.get("/colleges/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    async def test_a_malformed_id_is_422(self, client: AsyncClient, a_student):
        assert (await client.get("/colleges/not-a-uuid")).status_code == 422

    async def test_every_role_may_browse(self, client: AsyncClient, auth_as, seed_college):
        """
        Colleges carry no personal data. A coaching centre advising a student
        and an admin doing support both need to see the same listing.
        """
        for role, extra in (
            ("college", {"college_id": "11111111-1111-1111-1111-111111111111"}),
            ("coaching", {"coaching_centre_id": "22222222-2222-2222-2222-222222222222"}),
            ("admin", {}),
        ):
            auth_as(f"uid-{role}", role=role, **extra)
            assert (await client.get("/colleges/")).status_code == 200, role
