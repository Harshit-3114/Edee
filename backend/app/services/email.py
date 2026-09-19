"""
Outbound email.

Best-effort by contract: every send happens after the caller's commit, never
raises, and returns False when the mail never left. A failed SMTP send must
not turn a successful payment or signup into a 500 - the in-app notification
is the durable record; email is the tap on the shoulder.

Unconfigured (no SMTP_HOST) means disabled: development runs without a mail
server and every send becomes a debug log line. Set SMTP_* in production;
ADMIN_EMAIL optionally receives platform alerts (contact-form arrivals).
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 10


def email_configured() -> bool:
    return bool(settings.SMTP_HOST)


def _send_sync(to: str, subject: str, text_body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(
        f"""<html><body style="font-family:sans-serif;line-height:1.6;color:#111">
<h2 style="margin-bottom:4px">{subject}</h2>
<p style="white-space:pre-line">{text_body}</p>
<hr style="border:none;border-top:1px solid #ddd" />
<p style="font-size:12px;color:#666">Edee Apply - please do not reply to this automated message.</p>
</body></html>""",
        subtype="html",
    )

    server = smtplib.SMTP(
        settings.SMTP_HOST, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS
    )
    try:
        server.ehlo()
        if settings.SMTP_STARTTLS:
            server.starttls()
            server.ehlo()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)
    finally:
        try:
            server.quit()
        except Exception:
            pass


async def send_email(
    to: str,
    subject: str,
    text_body: str,
    *,
    purpose: str = "notification",
) -> bool:
    """
    Send one transactional email. Returns True when the SMTP server accepted
    it, False otherwise (including "email is not configured"). Never raises.
    """
    if not to or "@" not in to:
        logger.warning("Not sending %s email: no usable address", purpose)
        return False
    if not email_configured():
        logger.debug("Email disabled; would have sent %s to %s", purpose, to)
        return False
    try:
        await asyncio.to_thread(_send_sync, to, subject, text_body)
    except Exception:
        logger.exception("Could not send %s email to %s", purpose, to)
        return False
    logger.info("Sent %s email to %s", purpose, to)
    return True


def portal_url(path: str) -> str:
    """Absolute link for email bodies. PUBLIC_URL is the site, not the API."""
    base = settings.PUBLIC_URL.rstrip("/")
    return f"{base}{path if path.startswith('/') else '/' + path}"


__all__ = ["email_configured", "send_email", "portal_url"]
