import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text

from app.main import app
from app.middleware.auth import get_current_user


@pytest_asyncio.fixture
async def seed_landing(db_session):
    """A college with a slug and landing content, plus one open course."""
    college_id, course_id = uuid.uuid4(), uuid.uuid4()
    await db_session.execute(
        text(
            """
            INSERT INTO colleges
                (id, name, slug, location, city, state, type, active,
                 landing_hero_image_url, landing_description,
                 landing_gallery_urls)
            VALUES (:id, 'Landing College', 'landing-college', 'FC Road', 'Pune',
                    'Maharashtra', 'private', true,
                    'https://img.example/hero.jpg', 'A great place to study.',
                    '["https://img.example/1.jpg", "https://img.example/2.jpg"]')
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
async def landing_admin(client, auth_as, db_session, seed_landing):
    """A college admin bound to the landing college, already authenticated."""
    await db_session.execute(
        text(
            """
            INSERT INTO college_admins
                (id, firebase_uid, college_id, name, email, active)
            VALUES (:id, 'uid-landing-admin', :cid, 'Landing Admin',
                    'landing.admin@example.com', true)
            """
        ),
        {"id": uuid.uuid4(), "cid": seed_landing["college_id"]},
    )
    await db_session.commit()
    auth_as(
        "uid-landing-admin",
        role="college",
        college_id=seed_landing["college_id"],
    )
    return seed_landing


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

    async def test_list_carries_the_slug_for_landing_links(
        self, client: AsyncClient, a_student, seed_landing
    ):
        colleges = (await client.get("/colleges/")).json()
        match = [c for c in colleges if c["name"] == "Landing College"]
        assert match and match[0]["slug"] == "landing-college"

    async def test_list_needs_no_token(self, client: AsyncClient, seed_landing):
        """College discovery is top-of-funnel: anonymous visitors may browse."""
        from app.main import app as fastapi_app
        from app.middleware.auth import get_current_user

        fastapi_app.dependency_overrides.pop(get_current_user, None)
        try:
            response = await client.get("/colleges/")
            assert response.status_code == 200
            assert any(c["name"] == "Landing College" for c in response.json())
        finally:
            fastapi_app.dependency_overrides[get_current_user] = lambda: {
                "uid": "test-uid",
                "role": "student",
            }


class TestCollegeLanding:
    async def test_by_slug_returns_the_public_landing(
        self, client: AsyncClient, seed_landing
    ):
        response = await client.get("/colleges/by-slug/landing-college")
        assert response.status_code == 200
        body = response.json()
        assert body["slug"] == "landing-college"
        assert body["landing_hero_image_url"] == "https://img.example/hero.jpg"
        assert body["landing_description"] == "A great place to study."
        assert body["landing_gallery_urls"] == [
            "https://img.example/1.jpg",
            "https://img.example/2.jpg",
        ]
        assert body["courses"][0]["course_name"] == "B.Sc Statistics"
        assert body["courses"][0]["application_fee"] == 150000

    async def test_by_slug_unknown_or_malformed_is_404(
        self, client: AsyncClient, seed_landing
    ):
        assert (await client.get("/colleges/by-slug/no-such-college")).status_code == 404
        # Malformed slugs 404 rather than teaching the grammar via 422s.
        assert (await client.get("/colleges/by-slug/NOT-A-SLUG")).status_code == 404
        assert (await client.get("/colleges/by-slug/bad_slug!")).status_code == 404

    async def test_by_slug_hides_inactive_colleges(
        self, client: AsyncClient, seed_landing, db_session
    ):
        await db_session.execute(
            text("UPDATE colleges SET active = false WHERE slug = 'landing-college'")
        )
        await db_session.commit()
        assert (await client.get("/colleges/by-slug/landing-college")).status_code == 404

    async def test_by_slug_needs_no_token(self, client: AsyncClient, seed_landing):
        """The landing page is top-of-funnel: demanding a login strangles it."""
        app.dependency_overrides.pop(get_current_user, None)
        try:
            response = await client.get("/colleges/by-slug/landing-college")
            assert response.status_code == 200
        finally:
            app.dependency_overrides[get_current_user] = lambda: {
                "uid": "test-uid",
                "role": "student",
            }

    async def test_college_can_edit_its_own_landing_page(
        self, client: AsyncClient, landing_admin
    ):
        response = await client.patch(
            "/college/profile",
            json={
                "landing_description": "New copy.",
                "landing_gallery_urls": ["https://img.example/9.jpg"],
            },
        )
        assert response.status_code == 200

        profile = (await client.get("/college/profile")).json()
        assert profile["landing_description"] == "New copy."
        assert profile["landing_gallery_urls"] == ["https://img.example/9.jpg"]

    async def test_admin_can_edit_landing_fields(
        self, client: AsyncClient, auth_as, seed_landing
    ):
        auth_as("uid-admin-landing", role="admin")
        college_id = seed_landing["college_id"]
        response = await client.patch(
            f"/admin/colleges/{college_id}",
            json={"landing_hero_image_url": "https://img.example/admin.jpg"},
        )
        assert response.status_code == 200

        detail = (await client.get(f"/admin/colleges/{college_id}")).json()
        assert detail["landing_hero_image_url"] == "https://img.example/admin.jpg"
        assert detail["slug"] == "landing-college"

    async def test_admin_create_accepts_a_slug_and_rejects_collisions(
        self, client: AsyncClient, auth_as
    ):
        auth_as("uid-admin-slug", role="admin")
        payload = {
            "name": "Slug College",
            "location": "L",
            "city": "Pune",
            "state": "MH",
            "type": "private",
            "slug": "slug-college",
        }
        assert (await client.post("/admin/colleges", json=payload)).status_code == 201

        # Same name, no explicit slug: the generated slug collides, so this is
        # a 409 asking for an explicit slug rather than a 500.
        clash = dict(payload)
        del clash["slug"]
        assert (await client.post("/admin/colleges", json=clash)).status_code == 409
