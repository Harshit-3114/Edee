"""
Logging setup.

One line per request plus one line per interesting domain event — signup,
order, payment outcome, role change — and nothing else at INFO. Names, emails
and phone numbers never reach a log line; identifiers (row ids, order ids)
are what support pastes into a ticket.

Each request gets an id (`X-Request-ID`, also returned to the caller) so a
user report of "it failed at 2pm" turns into one grep instead of an
afternoon.
"""
import logging
import sys
from contextvars import ContextVar
from uuid import uuid4

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


_configured = False


def configure_logging(level: str = "INFO") -> None:
    """Idempotent: uvicorn and pytest both import this module, sometimes twice."""
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-5s [%(name)s] [req=%(request_id)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    )
    handler.addFilter(RequestIdFilter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    # Our request middleware logs one line per request, so uvicorn's access
    # log would only double it. Library chatter stays down regardless.
    access = logging.getLogger("uvicorn.access")
    access.setLevel(logging.WARNING)
    access.propagate = False
    for noisy in ("httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _configured = True


def new_request_id() -> str:
    request_id = uuid4().hex[:12]
    request_id_ctx.set(request_id)
    return request_id
