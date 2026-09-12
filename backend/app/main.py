from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from starlette.types import ASGIApp, Receive, Scope, Send
import logging

from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_handler
from app.db.connection import init_db
from app.routers import (
    students,
    colleges,
    shortlists,
    payments,
    college_portal,
    coaching_portal,
    admin,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


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


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    """
    Log the detail, return a generic message.

    FastAPI's default surfaces a traceback when debug is on; a stack trace tells
    a caller the file layout, the ORM, and often the query that failed.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(students.router, prefix="/students", tags=["student"])
app.include_router(colleges.router, prefix="/colleges", tags=["student"])
app.include_router(shortlists.router, prefix="/shortlists", tags=["student"])
app.include_router(payments.router, prefix="/payments", tags=["student"])
app.include_router(college_portal.router, prefix="/college", tags=["college"])
app.include_router(coaching_portal.router, prefix="/coaching", tags=["coaching"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok"}
