from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings, SQL_ECHO

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=2,  # small on purpose: PgBouncer does the multiplexing
    max_overflow=3,
    pool_timeout=10,
    pool_pre_ping=True,
    pool_recycle=1800,
    # echo prints statements *with their parameters* - names, emails, phone
    # numbers. Development only; see app/core/config.py.
    echo=SQL_ECHO,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Confirms the database is reachable at startup rather than on first request."""
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))


async def get_db():
    """
    One session per request.

    The rollback matters: without it a request that raises mid-transaction
    returns its connection to the pool still dirty, and the next request to
    borrow it fails on a transaction it never started.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
