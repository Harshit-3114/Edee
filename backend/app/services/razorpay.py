import razorpay
import hmac
import hashlib
from app.core.config import settings

razorpay_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verifies the X-Razorpay-Signature header against the raw request body.

    Must be given the raw bytes, not a re-serialised dict: re-encoding JSON
    changes key order and whitespace, and the HMAC then never matches.
    """
    if not signature or not settings.RAZORPAY_WEBHOOK_SECRET:
        return False
    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_payment_signature(
    razorpay_order_id: str, razorpay_payment_id: str, signature: str
) -> bool:
    """
    Verifies the handshake the browser returns when checkout closes.

    Signed with the API key secret over "order_id|payment_id" - a different
    secret and a different payload from the webhook signature, so the two are
    not interchangeable. compare_digest keeps the comparison constant-time.
    """
    if not signature:
        return False
    payload = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
