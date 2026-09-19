from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from starlette.types import ASGIApp, Message, Receive, Scope, Send
import logging
import os
import time
from pathlib import Path

from app.core.config import settings
from app.core.devmode import firebase_available, is_dev_mode, log_dev_mode_once
from app.core.logging import configure_logging, new_request_id
from app.core.rate_limit import limiter, rate_limit_handler
from app.db.connection import init_db
from app.routers import (
    auth as auth_router,
    students,
    colleges,
    shortlists,
    payments,
    notifications,
    contact,
    college_portal,
    coaching_portal,
    admin,
    dev,
)

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # A staging or production box must fail closed at boot, never run open:
    # dev mode is forbidden there even if requested, and running without
    # credentials is forbidden too. Development without credentials gets
    # dev mode instead (see app.core.devmode).
    if settings.ENVIRONMENT.lower() in {"staging", "production", "prod"}:
        if settings.DEV_MODE:
            raise RuntimeError(
                "refusing to boot: DEV_MODE=1 is set with ENVIRONMENT=%s, "
                "and dev mode is forbidden outside development"
                % settings.ENVIRONMENT
            )
        if not firebase_available():
            raise RuntimeError(
                "refusing to boot: ENVIRONMENT=%s but no Firebase service "
                "account is configured" % settings.ENVIRONMENT
            )
    if is_dev_mode():
        log_dev_mode_once()
    await init_db()
    yield
    # Mock users are process-scoped by design: a mock identity must never
    # survive the server that made it, or next boot inherits stale rows.
    if is_dev_mode():
        from app.routers.dev import cleanup_all_mock_users

        try:
            removed = await cleanup_all_mock_users()
            if removed:
                logger.info("dev shutdown: removed %d mock user(s)", removed)
        except Exception:
            logger.exception("dev shutdown cleanup failed")


app = FastAPI(
    title="College Platform API",
    version="1.1.0",
    lifespan=lifespan,
    # Interactive docs enumerate every endpoint and schema. Useful on a laptop,
    # a free map of the attack surface in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Uploaded files (college logos). Created at boot so the mount never fails on
# a fresh checkout; gitignored and volume-backed in production compose.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    # From the environment, never "*". With allow_credentials a wildcard origin
    # would let any site a signed-in student visits read their data.
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)


class SecurityHeadersMiddleware:
    """
    Baseline headers. This API returns JSON rather than markup, so the job is
    mostly to stop a browser from being clever with a response it should just
    hand to fetch().

    Written as pure ASGI (not FastAPI's BaseHTTPMiddleware): BaseHTTPMiddleware
    runs the downstream app in a separate anyio task group and event loop,
    which tears asyncpg apart under the test client. This runs inline in the
    same loop as the request.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                headers[b"x-content-type-options"] = b"nosniff"
                headers[b"x-frame-options"] = b"DENY"
                headers[b"referrer-policy"] = b"no-referrer"
                headers[b"cache-control"] = b"no-store"
                if settings.is_production:
                    headers[b"strict-transport-security"] = (
                        b"max-age=31536000; includeSubDomains"
                    )
                message["headers"] = list(headers.items())
            await send(message)

        await self.app(scope, receive, send_headers)


app.add_middleware(SecurityHeadersMiddleware)


class RequestLoggingMiddleware:
    """
    One line per request, plus an X-Request-ID header the caller can quote
    back to support. Pure ASGI for the same event-loop reason as
    SecurityHeadersMiddleware. Added last so it wraps the whole stack —
    CORS, rate limiting, security headers — and times all of it.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = new_request_id()
        started = time.perf_counter()
        status_code = 500

        async def send_logged(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = dict(message.get("headers", []))
                headers[b"x-request-id"] = request_id.encode("latin-1")
                message["headers"] = list(headers.items())
            await send(message)

        try:
            await self.app(scope, receive, send_logged)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            # Health checks fire every few seconds from Docker and uptime
            # monitors; they log at DEBUG so real traffic stays readable.
            level = logging.DEBUG if scope.get("path") == "/health" else logging.INFO
            logger.log(
                level,
                "%s %s -> %s (%.1fms)",
                scope.get("method", "?"),
                scope.get("path", "?"),
                status_code,
                elapsed_ms,
            )


app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    """
    Log the detail, return a generic message.

    FastAPI's default surfaces a traceback when debug is on; a stack trace tells
    a caller the file layout, the ORM, and often the query that failed.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(students.router, prefix="/students", tags=["student"])
app.include_router(colleges.router, prefix="/colleges", tags=["student"])
app.include_router(shortlists.router, prefix="/shortlists", tags=["student"])
app.include_router(payments.router, prefix="/payments", tags=["student"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(contact.router, prefix="/contact", tags=["contact"])
app.include_router(college_portal.router, prefix="/college", tags=["college"])
app.include_router(coaching_portal.router, prefix="/coaching", tags=["coaching"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(dev.router, prefix="/dev", tags=["dev"])


@app.get("/health")
async def health():
    # dev_mode tells local tooling (start.bat, the login page) whether
    # to offer dev tokens. It reveals nothing sensitive.
    return {"status": "ok", "dev_mode": is_dev_mode()}
