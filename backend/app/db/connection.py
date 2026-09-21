from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings, SQL_ECHO


_engine = None
_AsyncSessionLocal = None


def _database_url() -> tuple[str, dict]:
    """DATABASE_URL split into an asyncpg-safe URL plus connect args.

    SQLAlchemy forwards every URL query parameter as a connect() keyword, but
    asyncpg.connect() accepts neither `sslmode` nor `channel_binding` - so a
    stock Neon URL crashes with TypeError. Both are stripped here, and any
    `sslmode` other than `disable` becomes `connect_args={"ssl": True}`,
    which is the documented asyncpg way to demand TLS.

    A bare `postgresql://` scheme (exactly what Neon dashboard copy-paste and
    the Neon->Render integration deliver) is also upgraded to
    `postgresql+asyncpg://`: without a driver SQLAlchemy defaults to psycopg2,
    which is not installed and never will be. Local URLs already carry the
    driver and no query string, so they pass through untouched.
    """
    parts = urlsplit(settings.DATABASE_URL)
    if parts.scheme == "postgresql":
        parts = parts._replace(scheme="postgresql+asyncpg")
    params = parse_qsl(parts.query)
    sslmode = next((v for k, v in params if k == "sslmode"), None)
    query = [(k, v) for k, v in params if k not in ("sslmode", "channel_binding")]
    url = urlunsplit(parts._replace(query=urlencode(query)))
    connect_args = {"ssl": True} if sslmode and sslmode != "disable" else {}
    return url, connect_args


def get_engine():
    """Lazy engine creation - ensures the engine is created in the correct event loop."""
    global _engine
    if _engine is None:
        url, connect_args = _database_url()
        _engine = create_async_engine(
            url,
            connect_args=connect_args,
            pool_size=2,
            max_overflow=3,
            pool_timeout=10,
            pool_pre_ping=True,
            pool_recycle=1800,
            echo=SQL_ECHO,
        )
    return _engine


def get_session_factory():
    """Lazy session factory creation."""
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


async def init_db():
    """Confirms the database is reachable at startup rather than on first request."""
    async with get_engine().begin() as conn:
        await conn.execute(text("SELECT 1"))


async def get_db():
    """
    One session per request.

    The rollback matters: without it a request that raises mid-transaction
    returns its connection to the pool still dirty, and the next request to
    borrow it fails on a transaction it never started.
    """
    async with get_session_factory()() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
