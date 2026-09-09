"""
Seed script — populates colleges and courses for local development.
Run: python seeds/colleges.py
"""
import asyncio
import uuid
import re
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def make_slug(name: str) -> str:
    """Convert a college name to a URL‑friendly slug."""
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)   # replace non‑alnum with hyphen
    slug = slug.strip("-")
    return slug


COLLEGES = [
    {
        "name": "VIT Chennai",
        "location": "Chennai, Tamil Nadu",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "type": "private",
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 150000, "seats": 120},
            {"name": "B.Tech Electronics", "stream": "UG", "fee": 150000, "seats": 60},
            {"name": "M.Tech Computer Science", "stream": "PG", "fee": 200000, "seats": 30},
        ]
    },
    {
        "name": "SRM Institute of Science and Technology",
        "location": "Chennai, Tamil Nadu",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "type": "private",
        "courses": [
            {"name": "B.Tech Computer Science (AI/ML)", "stream": "UG", "fee": 135000, "seats": 90},
            {"name": "B.Tech Information Technology", "stream": "UG", "fee": 125000, "seats": 60},
            {"name": "MBA Technology Management", "stream": "PG", "fee": 180000, "seats": 45},
        ]
    },
    {
        "name": "Manipal Institute of Technology",
        "location": "Manipal, Karnataka",
        "city": "Manipal",
        "state": "Karnataka",
        "type": "private",
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 200000, "seats": 150},
            {"name": "B.Tech Mechanical Engineering", "stream": "UG", "fee": 185000, "seats": 90},
        ]
    },
    {
        "name": "PSG College of Technology",
        "location": "Coimbatore, Tamil Nadu",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "private",
        "courses": [
            {"name": "B.E. Computer Science", "stream": "UG", "fee": 80000, "seats": 60},
            {"name": "B.E. Electronics and Communication", "stream": "UG", "fee": 80000, "seats": 60},
            {"name": "M.E. Computer Science", "stream": "PG", "fee": 100000, "seats": 18},
        ]
    },
    {
        "name": "Amrita Vishwa Vidyapeetham",
        "location": "Coimbatore, Tamil Nadu",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "deemed",
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 160000, "seats": 120},
            {"name": "M.Tech Data Science", "stream": "PG", "fee": 175000, "seats": 30},
        ]
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for college_data in COLLEGES:
            slug = make_slug(college_data["name"])

            # Upsert college and get its actual ID
            result = await session.execute(text("""
                INSERT INTO colleges (id, name, slug, location, city, state, type, active)
                VALUES (:id, :name, :slug, :location, :city, :state, :type, true)
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            """), {
                "id": uuid.uuid4(),
                "name": college_data["name"],
                "slug": slug,
                "location": college_data["location"],
                "city": college_data["city"],
                "state": college_data["state"],
                "type": college_data["type"],
            })
            college_row = result.fetchone()
            college_id = college_row[0] if college_row else None

            # Fallback (shouldn't happen) – select by slug
            if not college_id:
                result = await session.execute(text("SELECT id FROM colleges WHERE slug = :slug"),
                                              {"slug": slug})
                college_id = result.scalar_one()

            # Insert courses for this college
            for course in college_data["courses"]:
                await session.execute(text("""
                    INSERT INTO college_courses
                        (id, college_id, course_name, stream, application_fee, seats, active)
                    VALUES (:id, :college_id, :name, :stream, :fee, :seats, true)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": uuid.uuid4(),
                    "college_id": college_id,
                    "name": course["name"],
                    "stream": course["stream"],
                    "fee": course["fee"],          # stored in rupees (API converts to paise)
                    "seats": course["seats"],
                })

        await session.commit()
        print(f"Seeded {len(COLLEGES)} colleges")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())