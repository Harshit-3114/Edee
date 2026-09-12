"""
Dependency checks behind GET /admin/system.

Each check returns a ServiceStatus and never raises: a monitoring endpoint
that 500s exactly when something is down is worse than useless. Latency is
measured where a real round trip happens; presence-only checks report no
latency. Details are fixed strings — never exception text, which can carry
file paths or credential fragments.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel
from sqlalchemy import text

from app.db.connection import get_engine

logger = logging.getLogger(__name__)

Status = Literal["operational", "degraded", "down"]


class ServiceStatus(BaseModel):
    name: str
    label: str
    status: Status
    latency_ms: Optional[int] = None
    detail: str = ""


class SystemStatus(BaseModel):
    overall: Status
    checked_at: datetime
    services: List[ServiceStatus]


def check_api() -> ServiceStatus:
    """Trivially operational: answering this question proves it."""
    return ServiceStatus(
        name="api", label="API", status="operational", detail="Responding"
    )


async def check_database() -> ServiceStatus:
    started = time.perf_counter()
    try:
        engine = get_engine()
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Health check: database unreachable")
        return ServiceStatus(
            name="database",
            label="PostgreSQL",
            status="down",
            detail="Cannot reach the database",
        )
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return ServiceStatus(
        name="database",
        label="PostgreSQL",
        status="operational",
        latency_ms=elapsed_ms,
        detail="SELECT 1 ok",
    )


def check_firebase() -> ServiceStatus:
    from app.middleware.auth import _firebase_app

    try:
        _firebase_app()
    except Exception:
        logger.exception("Health check: Firebase Admin SDK not usable")
        return ServiceStatus(
            name="firebase",
            label="Firebase Auth",
            status="down",
            detail="Service account not configured",
        )
    return ServiceStatus(
        name="firebase",
        label="Firebase Auth",
        status="operational",
        detail="Admin SDK initialised",
    )


def _razorpay_probe() -> None:
    from app.services.razorpay import razorpay_client

    razorpay_client.order.all({"count": 1})


def check_razorpay(timeout_seconds: float = 8.0) -> ServiceStatus:
    """
    One tiny authenticated listing proves connectivity *and* credentials.

    Bounded by a thread timeout: the SDK sets no timeout of its own, and an
    unbounded health check that hangs the admin page is a second outage.
    """
    started = time.perf_counter()
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_razorpay_probe)
            future.result(timeout=timeout_seconds)
    except Exception:
        logger.exception("Health check: Razorpay unreachable")
        return ServiceStatus(
            name="razorpay",
            label="Razorpay",
            status="down",
            detail="Unreachable or invalid credentials",
        )
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return ServiceStatus(
        name="razorpay",
        label="Razorpay",
        status="operational",
        latency_ms=elapsed_ms,
        detail="Authenticated listing ok",
    )


def summarize(services: List[ServiceStatus]) -> SystemStatus:
    """Overall is the worst of the parts. Degraded outranks operational."""
    rank = {"operational": 0, "degraded": 1, "down": 2}
    overall: Status = "operational"
    for service in services:
        if rank[service.status] > rank[overall]:
            overall = service.status
    return SystemStatus(
        overall=overall, checked_at=datetime.now(timezone.utc), services=services
    )
