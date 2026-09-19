from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import require_roles
from app.services.notify import notify
from app.services.email import portal_url, send_email
from app.models.payment import (
    CreateOrder,
    CreateOrderResponse,
    QuoteResponse,
    VerifyPayment,
)
from app.services.razorpay import (
    razorpay_client,
    verify_payment_signature,
    verify_webhook_signature,
)
from app.core.config import settings
from app.core.rate_limit import limited
import uuid
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_ITEMS_PER_ORDER = 25
# Paise of scholarship per extra form once an order outgrows the slab table.
# Matches the launch policy (the 6-form slab is exactly 6 x 500); the table
# stays the source of truth up to its largest row.
PER_FORM_BEYOND_SLABS = 50_000


def format_amount(paise: int) -> str:
    """Receipt-friendly rupees for email bodies. The API speaks paise;
    humans do not."""
    return f"₹{paise / 100:,.0f}"


async def scholarship_for_count(db: AsyncSession, count: int) -> int:
    """
    Volume discount in paise for an order covering `count` applications.

    Reads scholarship_slabs (min_forms -> discount_paise) and takes the best
    slab at or below the count. No slabs configured means no discount, so an
    unseeded database behaves exactly like the pre-scholarship code.
    """
    if count < 1:
        return 0
    result = await db.execute(
        text(
            "SELECT min_forms, discount_paise FROM scholarship_slabs "
            "ORDER BY min_forms"
        )
    )
    slabs = result.fetchall()
    if not slabs:
        return 0
    if count > slabs[-1][0]:
        return PER_FORM_BEYOND_SLABS * count
    return max(discount for forms, discount in slabs if forms <= count)


async def _student_id(user: dict, db: AsyncSession) -> uuid.UUID:
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return row[0]


async def _price_shortlist(
    db: AsyncSession, student_id: uuid.UUID, shortlist_ids: list
) -> tuple:
    """
    Price a set of shortlist entries: gross total, scholarship, payable.

    Shared by create-order and the quote endpoint so the number a student
    sees before paying is computed by the exact code that charges them.
    Raises the same HTTPExceptions either way.
    """
    requested = list(dict.fromkeys(shortlist_ids))  # de-duplicate, keep order
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
              AND (cc.closing_date IS NULL OR cc.closing_date > now())
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

    # Volume scholarship off the gross total. It can never exceed the total,
    # and Razorpay cannot charge less than a rupee, so a fully covered order
    # is refused rather than sent to the gateway as zero.
    discount = min(await scholarship_for_count(db, len(priced)), total_paise)
    payable = total_paise - discount
    if payable < 100:
        raise HTTPException(
            status_code=400,
            detail="The scholarship covers the whole fee, so there is nothing to pay.",
        )
    return priced, total_paise, discount, payable


@router.post("/create-order", response_model=CreateOrderResponse)
@limited("10/minute")
async def create_order(
    request: Request,
    body: CreateOrder,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _student_id(user, db)
    priced, total_paise, discount, payable = await _price_shortlist(
        db, student_id, body.shortlist_ids
    )

    order_id = uuid.uuid4()
    try:
        rz_order = razorpay_client.order.create(
            {
                "amount": payable,
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
            INSERT INTO orders
                (id, student_id, razorpay_order_id, amount, total_amount,
                 discount_amount, currency, status)
            VALUES (:id, :student_id, :razorpay_order_id, :amount, :total,
                    :discount, 'INR', 'created')
            """
        ),
        {
            "id": order_id,
            "student_id": student_id,
            "razorpay_order_id": rz_order["id"],
            "amount": payable,
            "total": total_paise,
            "discount": discount,
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

    logger.info(
        "order created id=%s items=%d total=%d discount=%d payable=%d",
        order_id,
        len(priced),
        total_paise,
        discount,
        payable,
    )
    return {
        "order_id": rz_order["id"],
        "amount": payable,
        "total_amount": total_paise,
        "discount_amount": discount,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.get("/scholarship")
async def scholarship_policy(db: AsyncSession = Depends(get_db)):
    """
    Current volume-discount slabs. Public: the home page renders the table
    straight from here so marketing and checkout can never disagree.
    """
    result = await db.execute(
        text(
            "SELECT min_forms, discount_paise FROM scholarship_slabs "
            "ORDER BY min_forms"
        )
    )
    slabs = [
        {"min_forms": row[0], "discount_paise": row[1]} for row in result.fetchall()
    ]
    return {"slabs": slabs, "per_form_beyond_paise": PER_FORM_BEYOND_SLABS}


@router.post("/quote", response_model=QuoteResponse)
@limited("30/minute")
async def quote_order(
    request: Request,
    body: CreateOrder,
    user: dict = Depends(require_roles("student")),
    db: AsyncSession = Depends(get_db),
):
    """
    What an order would cost, shown before any money moves.

    Runs the exact pricing path create-order uses — same re-pricing, same
    availability and duplicate checks, same scholarship — but stops before
    Razorpay and writes nothing. A quote that disagrees with the later charge
    would be worse than no quote, so the two share _price_shortlist.
    """
    student_id = await _student_id(user, db)
    priced, total_paise, discount, payable = await _price_shortlist(
        db, student_id, body.shortlist_ids
    )
    return {
        "item_count": len(priced),
        "total_amount": total_paise,
        "discount_amount": discount,
        "amount": payable,
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
        # 200 keeps Razorpay from hammering a second account's-order-id forever;
        # there is nothing to reconcile here.
        return {"status": "order_not_found"}

    # What Razorpay says was paid must match what we asked for. A mismatch is
    # either a bug on our side or someone paying a different amount against a
    # known order id. Either way it does not get to create applications, and the
    # order is marked failed so it can never be repriced or reused.
    if paid_amount != order.amount:
        await db.execute(
            text("UPDATE orders SET status = 'failed' WHERE id = :id"),
            {"id": order.id},
        )
        await db.commit()
        logger.error(
            "Amount mismatch on order %s: paid %s, expected %s",
            razorpay_order_id,
            paid_amount,
            order.amount,
        )
        return {"status": "amount_mismatch"}

    summary = await fulfill_order(
        db, order, razorpay_payment_id, signature, paid_amount
    )
    if summary.get("status") == "no_order_items":
        return summary

    await db.commit()
    logger.info(
        "webhook captured order=%s payment=%s applications=%d",
        razorpay_order_id,
        razorpay_payment_id,
        summary["applications"],
    )
    await send_capture_emails(
        summary["student"],
        summary["colleges"],
        summary["applications"],
        paid_amount,
    )
    return {"status": "ok", "applications": summary["applications"]}

async def fulfill_order(
    db: AsyncSession,
    order,
    razorpay_payment_id: str,
    signature: str,
    paid_amount: int,
) -> dict:
    """
    Turn a paid order into applications, audit rows and notifications.

    Shared by the Razorpay webhook (real money) and the dev mock-capture
    (no money): both must produce exactly the same records, so there is one
    function that does it. Writes join the caller's transaction; emails are
    the caller's job, after commit. Returns the summary the caller reports.
    """
    payment_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO payments
                (id, order_id, razorpay_payment_id, razorpay_signature, amount, status)
            VALUES (:id, :order_id, :rz_payment_id, :signature, :amount, 'captured')
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
        await db.execute(
            text("UPDATE orders SET status = 'failed' WHERE id = :id"), {"id": order.id}
        )
        await db.commit()
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

    # Tell every college in this order, plus the student who paid. A college
    # with no admin row yet simply gets no notification; the inbox is still
    # correct when someone signs up later.
    seen_colleges = {row.college_id for row in rows}
    college_mails: list = []
    for college_id in seen_colleges:
        names = await db.execute(
            text(
                """
                SELECT c.name AS college_name,
                       ca.firebase_uid AS admin_uid,
                       ca.email AS admin_email
                FROM colleges c
                LEFT JOIN college_admins ca ON ca.college_id = c.id
                WHERE c.id = :cid
                """
            ),
            {"cid": college_id},
        )
        for name in names.fetchall():
            if name.admin_uid is None:
                continue
            await notify(
                db,
                name.admin_uid,
                "college",
                "new_application",
                f"New paid application for {name.college_name}",
                "A student paid the application fee. Review it in your inbox.",
                "/college/applications",
            )
            if name.admin_email:
                college_mails.append((name.admin_email, name.college_name))
    student_uid = await db.execute(
        text("SELECT firebase_uid, email, name FROM students WHERE id = :sid"),
        {"sid": order.student_id},
    )
    uid_row = student_uid.fetchone()
    if uid_row is not None:
        await notify(
            db,
            uid_row.firebase_uid,
            "student",
            "payment_received",
            f"Payment received: {len(rows)} application"
            f"{'s' if len(rows) != 1 else ''} filed",
            "Track each one from your dashboard.",
            "/student/dashboard?paid=1",
        )

    return {
        "applications": len(rows),
        "student": (
            {"email": uid_row.email, "name": uid_row.name}
            if uid_row is not None
            else None
        ),
        "colleges": college_mails,
    }


async def send_capture_emails(
    student: dict | None, colleges: list, applications: int, paid_amount: int
) -> None:
    """Receipt to the payer, alert to each college. Best-effort, post-commit."""
    if student is not None:
        await send_email(
            student["email"],
            f"Payment received: {applications} application"
            f"{'s' if applications != 1 else ''} filed",
            f"Hi {student['name']},\n\n"
            f"We received {format_amount(paid_amount)} for {applications} "
            f"application{'s' if applications != 1 else ''}. "
            "The colleges have your application now.\n\n"
            f"Track each one here:\n{portal_url('/student/dashboard?paid=1')}",
            purpose="payment-receipt",
        )
    for admin_email, college_name in colleges:
        await send_email(
            admin_email,
            f"New paid application for {college_name}",
            "A student paid the application fee. "
            "Review it in your inbox:\n"
            f"{portal_url('/college/applications')}",
            purpose="new-application",
        )
