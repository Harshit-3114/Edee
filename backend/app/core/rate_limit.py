"""
Rate limiting for the endpoints an anonymous caller can hit hardest.

`POST /students/` mints accounts and `POST /payments/create-order` calls out
to Razorpay on every request, so both are cheap to abuse and expensive to
absorb. The webhook is deliberately unlimited: Razorpay retries deliveries,
and throttling the receiver turns a retry into a backlog.

Storage is in-memory, which is correct for a single backend replica and wrong
for several: with N replicas an attacker gets N times the budget. Past one
replica, move limiting to the ingress or point slowapi at Redis. Behind a
reverse proxy, run uvicorn with --proxy-headers so the limiter sees the real
client IP rather than the proxy's.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)


async def rate_limit_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again."},
    )


def limited(spec: str):
    """
    `@limited("5/minute")` on an endpoint.

    A no-op when ENVIRONMENT is test: the suite fires dozens of requests from
    one client IP and would trip real budgets nondeterministically. The limiter
    mechanism itself is covered by a dedicated test; staging is where the real
    budgets get exercised.
    """
    if settings.ENVIRONMENT == "test":
        return lambda fn: fn
    return limiter.limit(spec)
