from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings, SQL_ECHO


_engine = None
_AsyncSessionLocal = None


def get_engine():
    """Lazy engine creation - ensures the engine is created in the correct event loop."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
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
