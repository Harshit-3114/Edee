from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import require_roles
from app.models.payment import CreateOrder, CreateOrderResponse, VerifyPayment
from app.services.razorpay import (
    razorpay_client,
    verify_payment_signature,
    verify_webhook_signature,
)
from app.core.config import settings
import uuid
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_ITEMS_PER_ORDER = 25


async def _student_id(user: dict, db: AsyncSession) -> uuid.UUID:
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return row[0]


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    body: CreateOrder,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _student_id(user, db)

    requested = list(dict.fromkeys(body.shortlist_ids))  # de-duplicate, keep order
    if not requested:
        raise HTTPException(status_code=400, detail="No shortlist items given")
    if len(requested) > MAX_ITEMS_PER_ORDER:
        raise HTTPException(
            status_code=400,
            detail=f"An order can cover at most {MAX_ITEMS_PER_ORDER} applications",
        )

    # Every item is re-priced from the database. The client sends ids, never
    # amounts: a total that arrives from a browser is a total an attacker
    # chose. The student_id filter is what stops one student paying against
    # another student's shortlist.
    result = await db.execute(
        text(
            """
            SELECT s.id            AS shortlist_id,
                   s.college_id,
                   s.course_id,
                   cc.application_fee
            FROM shortlists s
            JOIN college_courses cc ON cc.id = s.course_id
            JOIN colleges c         ON c.id = s.college_id
            WHERE s.id = ANY(:ids)
              AND s.student_id = :student_id
              AND cc.active = true
              AND c.active = true
            """
        ),
        {"ids": requested, "student_id": student_id},
    )
    items = result.fetchall()

    if not items:
        raise HTTPException(status_code=400, detail="No valid shortlist items")

    # Refuse a partial order rather than silently charging for a subset. If an
    # item vanished or its course closed, the student should learn that before
    # paying, not discover it afterwards.
    if len(items) != len(requested):
        raise HTTPException(
            status_code=409,
            detail="Some items are no longer available. Refresh your shortlist and try again.",
        )

    # Already applied? Applications are unique per (student, college, course),
    # so charging again takes money for a row that cannot be created.
    existing = await db.execute(
        text(
            """
            SELECT 1 FROM applications
            WHERE student_id = :student_id AND course_id = ANY(:course_ids)
            LIMIT 1
            """
        ),
        {"student_id": student_id, "course_ids": [row.course_id for row in items]},
    )
    if existing.fetchone():
        raise HTTPException(
            status_code=409, detail="You have already applied to one of these courses"
        )

    # application_fee is stored in rupees; money leaves this API in paise.
    priced = [(row, row.application_fee * 100) for row in items]
    total_paise = sum(amount for _, amount in priced)
    if total_paise <= 0:
        raise HTTPException(status_code=400, detail="Nothing to pay")

    order_id = uuid.uuid4()
    try:
        rz_order = razorpay_client.order.create(
            {
                "amount": total_paise,
                "currency": "INR",
                "receipt": f"order_{order_id.hex[:12]}",
                "notes": {"student_id": str(student_id)},
            }
        )
    except Exception:
        logger.exception("Razorpay order creation failed")
        raise HTTPException(
            status_code=502, detail="Could not reach the payment provider"
        )

    await db.execute(
        text(
            """
            INSERT INTO orders (id, student_id, razorpay_order_id, amount, status)
            VALUES (:id, :student_id, :razorpay_order_id, :amount, 'created')
            """
        ),
        {
            "id": order_id,
            "student_id": student_id,
            "razorpay_order_id": rz_order["id"],
            "amount": total_paise,
        },
    )

    # Record exactly what this order covers. The webhook reads this, and only
    # this, when deciding which applications to create.
    for row, amount in priced:
        await db.execute(
            text(
                """
                INSERT INTO order_items
                    (id, order_id, shortlist_id, college_id, course_id, amount)
                VALUES (:id, :order_id, :shortlist_id, :college_id, :course_id, :amount)
                """
            ),
            {
                "id": uuid.uuid4(),
                "order_id": order_id,
                "shortlist_id": row.shortlist_id,
                "college_id": row.college_id,
                "course_id": row.course_id,
                "amount": amount,
            },
        )

    await db.commit()

    return {
        "order_id": rz_order["id"],
        "amount": total_paise,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPayment,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the browser right after Razorpay's checkout closes.

    A courtesy, so the student sees a confirmed screen immediately. The webhook
    stays the source of truth for creating applications: a browser can be closed
    mid-redirect, and what a browser reports is a claim, not a fact. The
    signature check means a forged call cannot mark an order paid by itself.
    """
    student_id = await _student_id(user, db)

    if not verify_payment_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    result = await db.execute(
        text(
            """
            SELECT id, status FROM orders
            WHERE razorpay_order_id = :rz_order_id AND student_id = :student_id
            """
        ),
        {"rz_order_id": body.razorpay_order_id, "student_id": student_id},
    )
    order = result.fetchone()
    if not order:
        # Do not confirm whether the order exists under somebody else.
        raise HTTPException(status_code=404, detail="Order not found")

    return {"status": order.status, "order_id": str(order.id)}


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not verify_webhook_signature(body, signature):
        logger.warning("Rejected a webhook with a bad signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Malformed payload")

    if event.get("event") != "payment.captured":
        return {"status": "ignored"}

    try:
        entity = event["payload"]["payment"]["entity"]
        razorpay_payment_id = entity["id"]
        razorpay_order_id = entity["order_id"]
        paid_amount = int(entity["amount"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Malformed payment payload")

    # Idempotency first. The primary key rejects a replay, and because this
    # shares a transaction with everything below, a failure part-way through
    # rolls the marker back too and a retry is allowed to do the work.
    try:
        await db.execute(
            text("INSERT INTO processed_webhooks (razorpay_payment_id) VALUES (:pid)"),
            {"pid": razorpay_payment_id},
        )
    except Exception:
        await db.rollback()
        return {"status": "already_processed"}

    result = await db.execute(
        text(
            "SELECT id, student_id, amount, status FROM orders "
            "WHERE razorpay_order_id = :oid"
        ),
        {"oid": razorpay_order_id},
    )
    order = result.fetchone()
    if not order:
        await db.rollback()
        logger.warning("Webhook for unknown order %s", razorpay_order_id)
        return {"status": "order_not_found"}

    # What Razorpay says was paid must match what we asked for. A mismatch is
    # either a bug on our side or someone paying a different amount against a
    # known order id. Either way it does not get to create applications.
    if paid_amount != order.amount:
        await db.rollback()
        logger.error(
            "Amount mismatch on order %s: paid %s, expected %s",
            razorpay_order_id,
            paid_amount,
            order.amount,
        )
        return {"status": "amount_mismatch"}

    payment_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO payments
                (id, order_id, razorpay_payment_id, razorpay_signature, amount)
            VALUES (:id, :order_id, :rz_payment_id, :signature, :amount)
            """
        ),
        {
            "id": payment_id,
            "order_id": order.id,
            "rz_payment_id": razorpay_payment_id,
            "signature": signature,
            "amount": paid_amount,
        },
    )

    await db.execute(
        text("UPDATE orders SET status = 'paid' WHERE id = :id"), {"id": order.id}
    )

    # Only the items this order actually covers. Driving this off the student's
    # whole shortlist, as the previous version did, handed out free
    # applications for everything they had ever saved.
    items = await db.execute(
        text("SELECT college_id, course_id FROM order_items WHERE order_id = :oid"),
        {"oid": order.id},
    )
    rows = items.fetchall()
    if not rows:
        await db.rollback()
        logger.error("Order %s has no order_items; refusing to guess", order.id)
        return {"status": "no_order_items"}

    for row in rows:
        await db.execute(
            text(
                """
                INSERT INTO applications
                    (id, student_id, college_id, course_id, payment_id, status)
                VALUES (:id, :student_id, :college_id, :course_id, :payment_id,
                        'payment_received')
                ON CONFLICT (student_id, college_id, course_id) DO NOTHING
                """
            ),
            {
                "id": uuid.uuid4(),
                "student_id": order.student_id,
                "college_id": row.college_id,
                "course_id": row.course_id,
                "payment_id": payment_id,
            },
        )

    await db.execute(
        text(
            """
            INSERT INTO audit_events
                (id, actor_id, actor_role, action, entity_type, entity_id)
            VALUES (:id, :actor, 'system', 'payment.captured', 'order', :entity)
            """
        ),
        {"id": uuid.uuid4(), "actor": order.student_id, "entity": order.id},
    )

    await db.commit()
    return {"status": "ok", "applications": len(rows)}
