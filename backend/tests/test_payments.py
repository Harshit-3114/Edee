import hashlib
import hmac
import json
import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text


def sign(body: bytes, secret: str = "webhook_secret") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def captured(order_id: str, amount: int, payment_id: str = "pay_test_1") -> bytes:
    return json.dumps(
        {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": payment_id,
                        "order_id": order_id,
                        "amount": amount,
                    }
                }
            },
        }
    ).encode()


@pytest_asyncio.fixture
async def slabs(db_session):
    """Launch-policy slabs: 1→250, 2→600, 3→1000, 4→1500, 5→2500, 6→3000 rupees."""
    await db_session.execute(
        text(
            """
            INSERT INTO scholarship_slabs (min_forms, discount_paise)
            VALUES (1, 25000), (2, 60000), (3, 100000),
                   (4, 150000), (5, 250000), (6, 300000)
            """
        )
    )
    await db_session.commit()


@pytest_asyncio.fixture
async def two_courses(db_session):
    """One college, two open courses at 1500 and 2000 rupees."""
    college_id = uuid.uuid4()
    course_a, course_b = uuid.uuid4(), uuid.uuid4()
    await db_session.execute(
        text(
            """
            INSERT INTO colleges (id, name, slug, location, city, state, type, active)
            VALUES (:id, 'Symbiosis', 'symbiosis', 'Viman Nagar', 'Pune', 'Maharashtra',
                    'private', true)
            """
        ),
        {"id": college_id},
    )
    for cid, name, fee in ((course_a, "BBA", 1500), (course_b, "BCA", 2000)):
        await db_session.execute(
            text(
                """
                INSERT INTO college_courses
                    (id, college_id, course_name, stream, duration_years, seats,
                     application_fee, active)
                VALUES (:id, :col, :name, 'UG', 3, 60, :fee, true)
                """
            ),
            {"id": cid, "col": college_id, "name": name, "fee": fee},
        )
    await db_session.commit()
    return {
        "college_id": str(college_id),
        "course_a": str(course_a),
        "course_b": str(course_b),
    }


class TestPayments:
    async def test_create_order_prices_from_the_database(
        self, client: AsyncClient, a_student, two_courses, monkeypatch
    ):
        """
        The client sends ids, never amounts. A total that arrives from the
        browser is a total an attacker chose.
        """
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_test123", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]

        response = await client.post(
            "/payments/create-order", json={"shortlist_ids": [entry_id]}
        )
        assert response.status_code == 200
        # 1500 rupees, charged as paise.
        assert response.json()["amount"] == 150000

    async def test_create_order_records_what_the_order_covers(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        """
        order_items is what the webhook reads. Without it the webhook had to
        guess, and it guessed "everything this student ever shortlisted".
        """
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_items_test", **payload},
        )
        for course in ("course_a", "course_b"):
            await client.post(
                "/shortlists/",
                json={
                    "college_id": two_courses["college_id"],
                    "course_id": two_courses[course],
                },
            )
        entries = (await client.get("/shortlists/")).json()
        # Pay for exactly one of the two.
        one = [e for e in entries if e["course_id"] == two_courses["course_a"]][0]

        await client.post("/payments/create-order", json={"shortlist_ids": [one["id"]]})

        rows = (
            await db_session.execute(
                text(
                    """
                    SELECT oi.course_id FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE o.razorpay_order_id = 'order_items_test'
                    """
                )
            )
        ).fetchall()
        assert len(rows) == 1
        assert str(rows[0][0]) == two_courses["course_a"]

    async def test_paying_for_one_does_not_apply_to_all(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        """
        The regression that mattered most.

        The webhook joined shortlists on student_id alone, so a student who
        shortlisted two courses and paid for one received applications for
        both. Colleges then saw applications nobody had paid for.
        """
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_regression", **payload},
        )
        for course in ("course_a", "course_b"):
            await client.post(
                "/shortlists/",
                json={
                    "college_id": two_courses["college_id"],
                    "course_id": two_courses[course],
                },
            )
        entries = (await client.get("/shortlists/")).json()
        paid_for = [e for e in entries if e["course_id"] == two_courses["course_a"]][0]

        order = await client.post(
            "/payments/create-order", json={"shortlist_ids": [paid_for["id"]]}
        )
        amount = order.json()["amount"]

        body = captured("order_regression", amount)
        result = await client.post(
            "/payments/webhook",
            content=body,
            headers={"X-Razorpay-Signature": sign(body)},
        )
        assert result.status_code == 200
        assert result.json()["status"] == "ok"

        applications = (
            await db_session.execute(text("SELECT course_id FROM applications"))
        ).fetchall()
        assert len(applications) == 1, "paying for one course applied to more than one"
        assert str(applications[0][0]) == two_courses["course_a"]

    async def test_create_order_refuses_someone_elses_shortlist(
        self, client: AsyncClient, auth_as, a_student, two_courses, monkeypatch
    ):
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_other", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]

        auth_as("uid-thief", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Thief",
                "email": "thief@example.com",
                "phone": "9876511111",
                "stream": "UG",
            },
        )
        response = await client.post(
            "/payments/create-order", json={"shortlist_ids": [entry_id]}
        )
        assert response.status_code == 400

    async def test_create_order_refuses_a_partial_order(
        self, client: AsyncClient, a_student, two_courses, monkeypatch
    ):
        """
        Silently charging for the subset it could find meant a student paid for
        two applications and received one.
        """
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_partial", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        real_id = (await client.get("/shortlists/")).json()[0]["id"]
        response = await client.post(
            "/payments/create-order",
            json={"shortlist_ids": [real_id, str(uuid.uuid4())]},
        )
        assert response.status_code == 409

    async def test_webhook_invalid_signature(self, client: AsyncClient):
        response = await client.post(
            "/payments/webhook",
            content='{"event": "payment.captured"}',
            headers={"X-Razorpay-Signature": "invalid"},
        )
        assert response.status_code == 400

    async def test_webhook_ignored_event(self, client: AsyncClient):
        body = b'{"event": "payment.failed"}'
        response = await client.post(
            "/payments/webhook",
            content=body,
            headers={"X-Razorpay-Signature": sign(body)},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ignored"

    async def test_webhook_rejects_an_amount_that_does_not_match(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_mismatch", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]
        await client.post("/payments/create-order", json={"shortlist_ids": [entry_id]})

        body = captured("order_mismatch", 1, payment_id="pay_mismatch")
        response = await client.post(
            "/payments/webhook",
            content=body,
            headers={"X-Razorpay-Signature": sign(body)},
        )
        assert response.json()["status"] == "amount_mismatch"

        rows = (
            await db_session.execute(text("SELECT count(*) FROM applications"))
        ).scalar_one()
        assert rows == 0

    async def test_webhook_is_idempotent(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        """Razorpay retries. A replay must not create a second application."""
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_replay", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]
        amount = (
            await client.post("/payments/create-order", json={"shortlist_ids": [entry_id]})
        ).json()["amount"]

        body = captured("order_replay", amount, payment_id="pay_replay")
        headers = {"X-Razorpay-Signature": sign(body)}

        first = await client.post("/payments/webhook", content=body, headers=headers)
        second = await client.post("/payments/webhook", content=body, headers=headers)

        assert first.json()["status"] == "ok"
        assert second.json()["status"] == "already_processed"

        count = (
            await db_session.execute(text("SELECT count(*) FROM applications"))
        ).scalar_one()
        assert count == 1

    async def _pay_for_one(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch, order_id, payment_id, amount=None
    ):
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": order_id, **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]
        response = await client.post(
            "/payments/create-order", json={"shortlist_ids": [entry_id]}
        )
        paid = amount if amount is not None else response.json()["amount"]
        body = captured(order_id, paid, payment_id=payment_id)
        return await client.post(
            "/payments/webhook",
            content=body,
            headers={"X-Razorpay-Signature": sign(body)},
        )

    async def test_a_student_can_withdraw_their_application(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        await self._pay_for_one(
            client, a_student, two_courses, db_session, monkeypatch,
            "order_withdraw", "pay_withdraw",
        )
        application_id = (
            await db_session.execute(text("SELECT id FROM applications"))
        ).scalar_one()

        # The owner withdraws from a pre-decision state.
        assert (
            await client.post(f"/students/me/applications/{application_id}/withdraw")
        ).status_code == 200
        status = (
            await db_session.execute(
                text("SELECT status FROM applications WHERE id = :id"),
                {"id": application_id},
            )
        ).scalar_one()
        assert status == "withdrawn"

    async def test_a_decision_cannot_be_withdrawn(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        await self._pay_for_one(
            client, a_student, two_courses, db_session, monkeypatch,
            "order_decided", "pay_decided",
        )
        application_id = (
            await db_session.execute(text("SELECT id FROM applications"))
        ).scalar_one()
        # Move it to a terminal state as the college would.
        await db_session.execute(
            text("UPDATE applications SET status = 'accepted' WHERE id = :id"),
            {"id": application_id},
        )
        await db_session.commit()

        assert (
            await client.post(f"/students/me/applications/{application_id}/withdraw")
        ).status_code == 409

    async def test_a_student_cannot_withdraw_someone_elses_application(
        self, client: AsyncClient, auth_as, a_student, two_courses, db_session, monkeypatch
    ):
        await self._pay_for_one(
            client, a_student, two_courses, db_session, monkeypatch,
            "order_foreign", "pay_foreign",
        )
        application_id = (
            await db_session.execute(text("SELECT id FROM applications"))
        ).scalar_one()

        auth_as("uid-other", role="student")
        await client.post(
            "/students/",
            json={
                "name": "Other Person",
                "email": "otherperson@example.com",
                "phone": "9876522222",
                "stream": "UG",
            },
        )
        assert (
            await client.post(f"/students/me/applications/{application_id}/withdraw")
        ).status_code == 404

    async def test_scholarship_math(self, db_session):
        """Slab lookup plus the per-form rule beyond the largest slab."""
        from app.routers.payments import scholarship_for_count

        await db_session.execute(
            text(
                "INSERT INTO scholarship_slabs (min_forms, discount_paise)"
                " VALUES (1, 25000), (2, 60000)"
            )
        )
        assert await scholarship_for_count(db_session, 0) == 0
        assert await scholarship_for_count(db_session, 1) == 25000
        assert await scholarship_for_count(db_session, 2) == 60000
        # Beyond the largest slab: flat per-form rate.
        assert await scholarship_for_count(db_session, 5) == 250000

    async def test_quote_matches_the_later_charge_and_writes_nothing(
        self, client: AsyncClient, a_student, two_courses, slabs, db_session
    ):
        """The number on screen must be computed by the code that charges."""
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]

        response = await client.post(
            "/payments/quote", json={"shortlist_ids": [entry_id]}
        )
        assert response.status_code == 200
        assert response.json() == {
            "item_count": 1,
            "total_amount": 150000,
            "discount_amount": 25000,
            "amount": 125000,
        }

        orders = (
            await db_session.execute(text("SELECT count(*) FROM orders"))
        ).scalar_one()
        assert orders == 0

    async def test_create_order_applies_the_scholarship(
        self, client: AsyncClient, a_student, two_courses, slabs, monkeypatch
    ):
        """
        Two courses at 1500 + 2000 rupees = 350000 paise gross. The 2-form
        slab takes 60000 off, so Razorpay is asked for 290000 — and the
        response shows the maths, not just the charge.
        """
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_scholarship", **payload},
        )
        for course in ("course_a", "course_b"):
            await client.post(
                "/shortlists/",
                json={
                    "college_id": two_courses["college_id"],
                    "course_id": two_courses[course],
                },
            )
        entries = (await client.get("/shortlists/")).json()

        charged = []
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: charged.append(payload["amount"])
            or {"id": "order_scholarship", **payload},
        )
        response = await client.post(
            "/payments/create-order",
            json={"shortlist_ids": [e["id"] for e in entries]},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_amount"] == 350000
        assert body["discount_amount"] == 60000
        assert body["amount"] == 290000
        assert charged == [290000]

    async def test_discounted_payment_still_creates_the_application(
        self, client: AsyncClient, a_student, two_courses, slabs, db_session, monkeypatch
    ):
        """The webhook compares against the discounted total, not the gross."""
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_discounted", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]
        # One course at 1500 rupees, 1-form slab of 250: payable 149750.
        order = await client.post(
            "/payments/create-order", json={"shortlist_ids": [entry_id]}
        )
        assert order.json()["amount"] == 150000 - 25000

        body = captured("order_discounted", 150000 - 25000, payment_id="pay_discounted")
        result = await client.post(
            "/payments/webhook",
            content=body,
            headers={"X-Razorpay-Signature": sign(body)},
        )
        assert result.json()["status"] == "ok"
        count = (
            await db_session.execute(text("SELECT count(*) FROM applications"))
        ).scalar_one()
        assert count == 1

    async def test_fees_collected_are_net_of_scholarship(
        self, client: AsyncClient, auth_as, a_student, two_courses, slabs,
        db_session, monkeypatch,
    ):
        """A college dashboard must report money actually collected."""
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_net", **payload},
        )
        await client.post(
            "/shortlists/",
            json={
                "college_id": two_courses["college_id"],
                "course_id": two_courses["course_a"],
            },
        )
        entry_id = (await client.get("/shortlists/")).json()[0]["id"]
        await client.post("/payments/create-order", json={"shortlist_ids": [entry_id]})
        body = captured("order_net", 150000 - 25000, payment_id="pay_net")
        await client.post(
            "/payments/webhook",
            content=body,
            headers={"X-Razorpay-Signature": sign(body)},
        )

        auth_as("uid-admin-net", role="admin")
        detail = (
            await client.get(f"/admin/colleges/{two_courses['college_id']}")
        ).json()
        assert detail["fees_collected"] == 150000 - 25000

    async def test_closed_courses_cannot_be_ordered(
        self, client: AsyncClient, a_student, two_courses, db_session, monkeypatch
    ):
        monkeypatch.setattr(
            "app.routers.payments.razorpay_client.order.create",
            lambda payload: {"id": "order_closed", **payload},
        )
        for course in ("course_a", "course_b"):
            await client.post(
                "/shortlists/",
                json={
                    "college_id": two_courses["college_id"],
                    "course_id": two_courses[course],
                },
            )
        entries = (await client.get("/shortlists/")).json()
        # The first course closes after shortlisting: the order must refuse
        # the stale item rather than charge for something that cannot be applied.
        await db_session.execute(
            text(
                "UPDATE college_courses SET closing_date = now() - make_interval(days => 1)"
                " WHERE id = :id"
            ),
            {"id": two_courses["course_a"]},
        )
        await db_session.commit()

        response = await client.post(
            "/payments/create-order",
            json={"shortlist_ids": [e["id"] for e in entries]},
        )
        assert response.status_code == 409
