"""
Seed script — scholarship slabs for local development.
Run: python -m seeds.scholarships

One row per form count: applying to that many courses at once earns the
discount off the summed fees. Matches the launch policy (1 form -> Rs.250
off, ..., 5 forms -> Rs.2,500 off); beyond the largest slab the API charges
a flat Rs.500 per form. Upserted, so re-running only corrects drift.
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# (forms at once, discount in paise)
SLABS = [
    (1, 25000),
    (2, 60000),
    (3, 100000),
    (4, 150000),
    (5, 250000),
    (6, 300000),
]


async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for min_forms, discount in SLABS:
            await session.execute(text("""
                INSERT INTO scholarship_slabs (min_forms, discount_paise)
                VALUES (:min_forms, :discount)
                ON CONFLICT (min_forms)
                DO UPDATE SET discount_paise = EXCLUDED.discount_paise
            """), {"min_forms": min_forms, "discount": discount})

        await session.commit()
        print(f"Seeded {len(SLABS)} scholarship slabs")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
