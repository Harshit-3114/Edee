from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.payment import CreateOrder, CreateOrderResponse
from app.services.razorpay import razorpay_client, verify_webhook_signature
from app.core.config import settings
import uuid
import json

router = APIRouter()


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    body: CreateOrder,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]}
    )
    student = result.fetchone()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_id = student[0]

    result = await db.execute(text("""
        SELECT cc.application_fee
        FROM shortlists s
        JOIN college_courses cc ON cc.id = s.course_id
        WHERE s.id = ANY(:ids) AND s.student_id = :student_id
    """), {"ids": body.shortlist_ids, "student_id": student_id})

    fees = result.fetchall()
    if not fees:
        raise HTTPException(status_code=400, detail="No valid shortlist items")

    total_paise = sum(row[0] * 100 for row in fees)

    rz_order = razorpay_client.order.create({
        "amount": total_paise,
        "currency": "INR",
        "receipt": f"order_{uuid.uuid4().hex[:8]}",
    })

    order_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO orders (id, student_id, razorpay_order_id, amount, status)
        VALUES (:id, :student_id, :razorpay_order_id, :amount, 'created')
    """), {
        "id": order_id,
        "student_id": student_id,
        "razorpay_order_id": rz_order["id"],
        "amount": total_paise,
    })
    await db.commit()

    return {
        "order_id": rz_order["id"],
        "amount": total_paise,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    event = json.loads(body)

    if event.get("event") != "payment.captured":
        return {"status": "ignored"}

    payment_entity = event["payload"]["payment"]["entity"]
    razorpay_payment_id = payment_entity["id"]
    razorpay_order_id = payment_entity["order_id"]
    razorpay_signature = signature
    amount = payment_entity["amount"]

    try:
        await db.execute(text("""
            INSERT INTO processed_webhooks (razorpay_payment_id)
            VALUES (:payment_id)
        """), {"payment_id": razorpay_payment_id})
    except Exception:
        await db.rollback()
        return {"status": "already_processed"}

    result = await db.execute(text("""
        SELECT id, student_id FROM orders
        WHERE razorpay_order_id = :order_id
    """), {"order_id": razorpay_order_id})
    order = result.fetchone()
    if not order:
        await db.rollback()
        return {"status": "order_not_found"}

    order_id, student_id = order

    payment_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO payments
            (id, order_id, razorpay_payment_id, razorpay_signature, amount)
        VALUES (:id, :order_id, :razorpay_payment_id, :signature, :amount)
    """), {
        "id": payment_id,
        "order_id": order_id,
        "razorpay_payment_id": razorpay_payment_id,
        "signature": razorpay_signature,
        "amount": amount,
    })

    await db.execute(text("""
        UPDATE orders SET status = 'paid' WHERE id = :id
    """), {"id": order_id})

    shortlists = await db.execute(text("""
        SELECT s.id, s.college_id, s.course_id
        FROM shortlists s
        JOIN orders o ON o.student_id = s.student_id
        WHERE o.id = :order_id
    """), {"order_id": order_id})

    for row in shortlists.fetchall():
        try:
            await db.execute(text("""
                INSERT INTO applications
                    (id, student_id, college_id, course_id, payment_id, status)
                VALUES (:id, :student_id, :college_id, :course_id, :payment_id,
                        'payment_received')
                ON CONFLICT (student_id, college_id, course_id) DO NOTHING
            """), {
                "id": uuid.uuid4(),
                "student_id": student_id,
                "college_id": row[1],
                "course_id": row[2],
                "payment_id": payment_id,
            })
        except Exception:
            pass

    await db.commit()
    return {"status": "ok"}