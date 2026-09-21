"""
Seed script — populates colleges and courses for local development.
Run: python -m seeds.colleges

Fees here are application (form) fees in rupees, matching the
college_courses.application_fee column; the API converts to paise.
closing_in_days, when present, sets a course closing date relative to now
so deadline displays and guards have something to work with.
"""
import asyncio
import uuid
import re
import json
from datetime import datetime, timedelta, timezone
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
        "video_url": "https://www.youtube.com/embed/placeholder1",
        "overview": "VIT Chennai is a premier private institution offering a wide range of engineering and technology programs.",
        "faqs": [
            {"question": "What streams are offered?", "answer": "UG and PG programs in engineering, technology, and management."},
            {"question": "Hostel facility?", "answer": "Yes, separate hostels for boys and girls."}
        ],
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 2000, "seats": 120, "closes_in_days": 90},
            {"name": "B.Tech Electronics", "stream": "UG", "fee": 2000, "seats": 60, "closes_in_days": 90},
            {"name": "M.Tech Computer Science", "stream": "PG", "fee": 2500, "seats": 30, "closes_in_days": 60},
        ]
    },
    {
        "name": "SRM Institute of Science and Technology",
        "location": "Chennai, Tamil Nadu",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder2",
        "overview": "SRM Institute of Science and Technology is a leading private university known for its research and innovation.",
        "faqs": [
            {"question": "What is the admission process?", "answer": "Based on SRMJEEE entrance exam and counseling."},
            {"question": "Campus facilities?", "answer": "Modern labs, library, sports complex, and hostels."}
        ],
        "courses": [
            {"name": "B.Tech Computer Science (AI/ML)", "stream": "UG", "fee": 2000, "seats": 90, "closes_in_days": 75},
            {"name": "B.Tech Information Technology", "stream": "UG", "fee": 1800, "seats": 60, "closes_in_days": 75},
            {"name": "MBA Technology Management", "stream": "PG", "fee": 2500, "seats": 45, "closes_in_days": 60},
        ]
    },
    {
        "name": "Manipal Institute of Technology",
        "location": "Manipal, Karnataka",
        "city": "Manipal",
        "state": "Karnataka",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder3",
        "overview": "Manipal Institute of Technology offers world‑class engineering education in a scenic campus.",
        "faqs": [
            {"question": "Scholarships?", "answer": "Merit‑based scholarships up to 100% tuition waiver."},
            {"question": "Placements?", "answer": "Top recruiters include Microsoft, Amazon, and Google."}
        ],
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 2500, "seats": 150, "closes_in_days": 90},
            {"name": "B.Tech Mechanical Engineering", "stream": "UG", "fee": 2000, "seats": 90, "closes_in_days": 90},
        ]
    },
    {
        "name": "PSG College of Technology",
        "location": "Coimbatore, Tamil Nadu",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder4",
        "overview": "PSG College of Technology is renowned for its industry‑aligned curriculum and strong alumni network.",
        "faqs": [
            {"question": "Internship support?", "answer": "Dedicated placement cell with 200+ industry partners."},
            {"question": "Research centers?", "answer": "Centers in AI, IoT, and renewable energy."}
        ],
        "courses": [
            {"name": "B.E. Computer Science", "stream": "UG", "fee": 1500, "seats": 60, "closes_in_days": 60},
            {"name": "B.E. Electronics and Communication", "stream": "UG", "fee": 1500, "seats": 60, "closes_in_days": 60},
            {"name": "M.E. Computer Science", "stream": "PG", "fee": 2000, "seats": 18, "closes_in_days": 45},
        ]
    },
    {
        "name": "Amrita Vishwa Vidyapeetham",
        "location": "Coimbatore, Tamil Nadu",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "deemed",
        "video_url": "https://www.youtube.com/embed/placeholder5",
        "overview": "Amrita Vishwa Vidyapeetham is a multi‑campus deemed university with a focus on values‑based education.",
        "faqs": [
            {"question": "Accreditation?", "answer": "NAAC A++ and NBA accredited programs."},
            {"question": "International collaborations?", "answer": "Partnerships with 150+ universities worldwide."}
        ],
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 2000, "seats": 120, "closes_in_days": 90},
            {"name": "M.Tech Data Science", "stream": "PG", "fee": 2500, "seats": 30, "closes_in_days": 60},
        ]
    },
    {
        "name": "Pearl Academy",
        "location": "New Delhi, Delhi",
        "city": "New Delhi",
        "state": "Delhi",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder6",
        "overview": "Pearl Academy specializes in design, fashion, and media education with industry‑centric programs.",
        "faqs": [
            {"question": "Portfolio required?", "answer": "Yes, a creative portfolio is part of admission."},
            {"question": "Study abroad?", "answer": "Semester exchange with partner universities in Europe."}
        ],
        "courses": [
            {"name": "B.Des Communication Design", "stream": "UG", "fee": 3500, "seats": 60, "closes_in_days": 75},
            {"name": "B.Des Fashion Design", "stream": "UG", "fee": 3500, "seats": 60, "closes_in_days": 75},
        ]
    },
    {
        "name": "ISDI School of Design and Innovation",
        "location": "Mumbai, Maharashtra",
        "city": "Mumbai",
        "state": "Maharashtra",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder7",
        "overview": "ISDI offers cutting‑edge design and innovation programs in the heart of Mumbai's creative district.",
        "faqs": [
            {"question": "Industry projects?", "answer": "Live projects with top design firms each semester."},
            {"question": "Faculty background?", "answer": "Practicing designers and academicians from premier institutes."}
        ],
        "courses": [
            {"name": "B.Des Communication Design", "stream": "UG", "fee": 3500, "seats": 40, "closes_in_days": 60},
        ]
    },
    {
        "name": "Anant National University",
        "location": "Ahmedabad, Gujarat",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder8",
        "overview": "Anant National University focuses on sustainable design and architecture education.",
        "faqs": [
            {"question": "Campus sustainability?", "answer": "Green campus with solar power and water recycling."},
            {"question": "Admission test?", "answer": "Design aptitude test followed by interview."}
        ],
        "courses": [
            {"name": "B.Des Interaction Design", "stream": "UG", "fee": 2000, "seats": 50, "closes_in_days": 90},
        ]
    },
    {
        "name": "World University of Design",
        "location": "Sonipat, Haryana",
        "city": "Sonipat",
        "state": "Haryana",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder9",
        "overview": "World University of Design provides interdisciplinary design education with global exposure.",
        "faqs": [
            {"question": "International faculty?", "answer": "Visiting professors from Europe and USA each year."},
            {"question": "Placement sectors?", "answer": "Design studios, tech companies, and startups."}
        ],
        "courses": [
            {"name": "B.Des Product Design", "stream": "UG", "fee": 1500, "seats": 40, "closes_in_days": 60},
            {"name": "BBA Design Strategy and Management", "stream": "UG", "fee": 1500, "seats": 30, "closes_in_days": 60},
        ]
    },
    {
        "name": "Indian Institute of Art and Design",
        "location": "New Delhi, Delhi",
        "city": "New Delhi",
        "state": "Delhi",
        "type": "private",
        "video_url": "https://www.youtube.com/embed/placeholder10",
        "overview": "IIAD blends traditional art practices with contemporary design thinking.",
        "faqs": [
            {"question": "Scholarship for artists?", "answer": "Merit‑based scholarships for portfolio excellence."},
            {"question": "Exhibition opportunities?", "answer": "Annual graduate show open to industry recruiters."}
        ],
        "courses": [
            {"name": "B.A. Communication Design", "stream": "UG", "fee": 2000, "seats": 40, "closes_in_days": 45},
        ]
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Ensure new columns exist (idempotent) so seeding works even if migration hasn't run yet
        for col_sql in [
            "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS video_url TEXT",
            "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS overview TEXT",
            "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS faqs JSONB",
        ]:
            await session.execute(text(col_sql))
        await session.commit()

        for college_data in COLLEGES:
            slug = make_slug(college_data["name"])

            # Upsert college and get its actual ID
            result = await session.execute(text("""
                INSERT INTO colleges (id, name, slug, location, city, state, type, active,
                                      video_url, overview, faqs)
                VALUES (:id, :name, :slug, :location, :city, :state, :type, true,
                        :video_url, :overview, :faqs)
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,
                                                 video_url = EXCLUDED.video_url,
                                                 overview = EXCLUDED.overview,
                                                 faqs = EXCLUDED.faqs
                RETURNING id
            """), {
                "id": uuid.uuid4(),
                "name": college_data["name"],
                "slug": slug,
                "location": college_data["location"],
                "city": college_data["city"],
                "state": college_data["state"],
                "type": college_data["type"],
                "video_url": college_data.get("video_url"),
                "overview": college_data.get("overview"),
                "faqs": json.dumps(college_data.get("faqs")) if college_data.get("faqs") else None,
            })
            college_row = result.fetchone()
            college_id = college_row[0] if college_row else None

            # Fallback (shouldn't happen) – select by slug
            if not college_id:
                result = await session.execute(text("SELECT id FROM colleges WHERE slug = :slug"),
                                              {"slug": slug})
                college_id = result.scalar_one()

            # Courses are reseeded wholesale per college: there is no natural
            # unique key on (college, course name), so an upsert is impossible
            # and re-running would duplicate rows forever.
            await session.execute(
                text("DELETE FROM college_courses WHERE college_id = :cid"),
                {"cid": college_id},
            )
            # Insert courses for this college
            for course in college_data["courses"]:
                closes_in_days = course.get("closes_in_days")
                closing_date = (
                    datetime.now(timezone.utc) + timedelta(days=closes_in_days)
                    if closes_in_days
                    else None
                )
                await session.execute(text("""
                    INSERT INTO college_courses
                        (id, college_id, course_name, stream, application_fee, seats,
                         closing_date, active)
                    VALUES (:id, :college_id, :name, :stream, :fee, :seats,
                            :closing_date, true)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": uuid.uuid4(),
                    "college_id": college_id,
                    "name": course["name"],
                    "stream": course["stream"],
                    "fee": course["fee"],          # stored in rupees (API converts to paise)
                    "seats": course["seats"],
                    "closing_date": closing_date,
                })

        await session.commit()
        print(f"Seeded {len(COLLEGES)} colleges")

        # One coaching centre so the coaching portal has something to show
        # without needing the Firebase-backed seeds/users.py.
        existing_centre = await session.execute(
            text("SELECT 1 FROM coaching_centers LIMIT 1")
        )
        if not existing_centre.fetchone():
            await session.execute(text("""
                INSERT INTO coaching_centers (id, name, city, state, active)
                VALUES (:id, 'Pragati Career Academy', 'Pune', 'Maharashtra', true)
            """), {"id": uuid.uuid4()})
            await session.commit()
            print("Seeded 1 coaching centre")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())