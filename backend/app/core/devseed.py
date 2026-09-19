"""
Dev-mode mock catalogue.

When the server boots in dev mode against an empty database, the site would
otherwise show blank pages everywhere: no colleges to browse, nothing to
shortlist, no deadlines to display. This seeds a small realistic catalogue
(colleges, courses with windows, a coaching centre, scholarship slabs) so
the mock walkthrough works out of the box.

Rules, all load-bearing:

1. Runs ONLY in dev mode. Production, staging and test never call it, and
   it refuses to run if dev mode is off.
2. Only seeds an EMPTY catalogue (no colleges at all). A database with real
   rows is never touched, added to, or "topped up".
3. Lives in app/ rather than seeds/ on purpose: seeds/ is excluded from the
   production image and carries known passwords, so app code must never
   import it. This module has no secrets in it - just college names.

No students, applications or users are seeded here: mock identities are
provisioned on demand at sign-in (POST /dev/mock-user) and die with the
session, so people never leak across restarts.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.devmode import is_dev_mode

logger = logging.getLogger(__name__)

# (forms at once, discount in paise) - mirrors seeds/scholarships.py.
SLABS = [
    (1, 25000),
    (2, 60000),
    (3, 100000),
    (4, 150000),
    (5, 250000),
    (6, 300000),
]

COLLEGES = [
    {
        "name": "Fergusson College",
        "slug": "fergusson-college",
        "location": "FC Road",
        "city": "Pune",
        "state": "Maharashtra",
        "type": "private",
        "description": "A historic Pune institution offering undergraduate and postgraduate programmes across sciences and humanities.",
        "phases": "Phase 1: applications open now; Phase 2: spot round after the first merit list.",
        "courses": [
            {
                "name": "B.Sc Statistics",
                "stream": "UG",
                "fee": 1500,
                "seats": 60,
                "opens_in_days": -10,
                "closes_in_days": 80,
                "intake": "Fall 2027",
            },
            {
                "name": "M.Sc Statistics",
                "stream": "PG",
                "fee": 2000,
                "seats": 20,
                "opens_in_days": -10,
                "closes_in_days": 60,
                "intake": "Fall 2027",
            },
        ],
    },
    {
        "name": "Christ University",
        "slug": "christ-university",
        "location": "Hosur Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "type": "private",
        "description": "A multi-disciplinary university known for commerce, management and humanities programmes.",
        "phases": "Phase 1: applications open now; Phase 2: interviews in May.",
        "courses": [
            {
                "name": "BBA",
                "stream": "UG",
                "fee": 2000,
                "seats": 120,
                "opens_in_days": -5,
                "closes_in_days": 90,
                "intake": "July 2027 intake",
            },
            {
                "name": "B.A Economics",
                "stream": "UG",
                "fee": 1800,
                "seats": 60,
                "opens_in_days": 14,
                "closes_in_days": 100,
                "intake": "July 2027 intake",
            },
        ],
    },
    {
        "name": "St. Xavier's College",
        "slug": "st-xaviers-college",
        "location": "Fort",
        "city": "Mumbai",
        "state": "Maharashtra",
        "type": "private",
        "description": "A storied Mumbai college with strong arts and science departments.",
        "phases": None,
        "courses": [
            {
                "name": "B.A Economics",
                "stream": "UG",
                "fee": 1250,
                "seats": 60,
                "opens_in_days": -20,
                "closes_in_days": 45,
                "intake": None,
            },
        ],
    },
]


async def seed_mock_catalogue() -> str:
    """
    Seed the mock catalogue if dev mode is on and no colleges exist.
    Returns 'seeded', 'exists' or 'disabled'. Never raises: a catalogue
    problem must not fail server boot.
    """
    if not is_dev_mode():
        return "disabled"

    from app.db.connection import get_session_factory

    try:
        async with get_session_factory()() as session:
            count = (
                await session.execute(text("SELECT count(*) FROM colleges"))
            ).scalar_one()
            if count and count > 0:
                return "exists"

            now = datetime.now(timezone.utc)
            colleges = 0
            courses = 0
            for college in COLLEGES:
                college_id = uuid.uuid4()
                await session.execute(
                    text(
                        """
                        INSERT INTO colleges
                            (id, name, slug, location, city, state, type, active,
                             landing_description, application_phases)
                        VALUES (:id, :name, :slug, :location, :city, :state,
                                :type, true, :description, :phases)
                        ON CONFLICT (slug) DO NOTHING
                        """
                    ),
                    {
                        "id": college_id,
                        "name": college["name"],
                        "slug": college["slug"],
                        "location": college["location"],
                        "city": college["city"],
                        "state": college["state"],
                        "type": college["type"],
                        "description": college["description"],
                        "phases": college["phases"],
                    },
                )
                colleges += 1
                for course in college["courses"]:
                    await session.execute(
                        text(
                            """
                            INSERT INTO college_courses
                                (id, college_id, course_name, stream,
                                 duration_years, seats, application_fee,
                                 application_start_date, intake_info,
                                 closing_date, active)
                            VALUES (:id, :cid, :name, :stream, 3, :seats, :fee,
                                    :start_date, :intake, :closing_date, true)
                            """
                        ),
                        {
                            "id": uuid.uuid4(),
                            "cid": college_id,
                            "name": course["name"],
                            "stream": course["stream"],
                            "seats": course["seats"],
                            "fee": course["fee"],
                            "start_date": now + timedelta(days=course["opens_in_days"]),
                            "intake": course["intake"],
                            "closing_date": now + timedelta(days=course["closes_in_days"]),
                        },
                    )
                    courses += 1

            await session.execute(
                text(
                    """
                    INSERT INTO coaching_centers
                        (id, name, city, state, active, amount_per_lead)
                    VALUES (:id, 'Pragati Career Academy', 'Pune',
                            'Maharashtra', true, 10000)
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"id": uuid.uuid4()},
            )
            for min_forms, discount in SLABS:
                await session.execute(
                    text(
                        """
                        INSERT INTO scholarship_slabs (min_forms, discount_paise)
                        VALUES (:min_forms, :discount)
                        ON CONFLICT (min_forms) DO NOTHING
                        """
                    ),
                    {"min_forms": min_forms, "discount": discount},
                )
            await session.commit()
    except Exception:
        logger.exception("Mock catalogue seeding failed")
        return "failed"

    logger.warning(
        "DEV MODE seeded a mock catalogue: %d colleges, %d courses. "
        "Real data was absent; nothing was overwritten.",
        colleges,
        courses,
    )
    return "seeded"
