import hashlib
import hmac
import json
import uuid

import pytest
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
async def two_courses(db_session):
    """One college, two open courses at 1500 and 2000 rupees."""
    college_id = uuid.uuid4()
    course_a, course_b = uuid.uuid4(), uuid.uuid4()
    await db_session.execute(
        text(
            """
            INSERT INTO colleges (id, name, location, city, state, type, active)
            VALUES (:id, 'Symbiosis', 'Viman Nagar', 'Pune', 'Maharashtra',
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
