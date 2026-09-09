"""
One account per role, so every portal is reachable on a fresh database.

Run after seeds/colleges.py:

    python -m seeds.users

Creates a Firebase user and the matching row for each role, then sets the
custom claim. Refuses to run against a production environment: these are known
passwords, and a known password on a real deployment is not a seed, it is a
back door.
"""
import asyncio
import os
import sys
import uuid

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
from app.db.connection import AsyncSessionLocal  # noqa: E402
from app.services.firebase import assign_role  # noqa: E402
from app.middleware.auth import _firebase_app  # noqa: E402

PASSWORD = "Test@1234"

SEED_USERS = [
    ("admin@local.test", "Nikhil Raut", "admin"),
    ("college@local.test", "Priya Nair", "college"),
    ("coaching@local.test", "Imran Qureshi", "coaching"),
]


async def main() -> None:
    if settings.is_production:
        raise SystemExit("Refusing to seed accounts with known passwords in production")

    from firebase_admin import auth as firebase_auth

    app = _firebase_app()

    async with AsyncSessionLocal() as db:
        college = (
            await db.execute(text("SELECT id, name FROM colleges ORDER BY name LIMIT 1"))
        ).fetchone()
        if not college:
            raise SystemExit("No colleges found. Run `python -m seeds.colleges` first.")

        centre = (
            await db.execute(
                text("SELECT id, name FROM coaching_centers ORDER BY name LIMIT 1")
            )
        ).fetchone()
        if not centre:
            centre_id = uuid.uuid4()
            await db.execute(
                text(
                    """
                    INSERT INTO coaching_centers (id, name, city, state, active)
                    VALUES (:id, 'Pragati Career Academy', 'Pune', 'Maharashtra', true)
                    """
                ),
                {"id": centre_id},
            )
            await db.commit()
            print("Created coaching centre: Pragati Career Academy")
        else:
            centre_id = centre.id

        for email, name, role in SEED_USERS:
            try:
                fb_user = firebase_auth.get_user_by_email(email, app=app)
                firebase_auth.update_user(fb_user.uid, password=PASSWORD, app=app)
            except firebase_auth.UserNotFoundError:
                fb_user = firebase_auth.create_user(
                    email=email, password=PASSWORD, display_name=name, app=app
                )

            row_id = uuid.uuid4()
            if role == "college":
                await db.execute(
                    text(
                        """
                        INSERT INTO college_admins
                            (id, firebase_uid, college_id, name, email, active)
                        VALUES (:id, :uid, :org, :name, :email, true)
                        ON CONFLICT (firebase_uid) DO UPDATE SET active = true
                        """
                    ),
                    {
                        "id": row_id,
                        "uid": fb_user.uid,
                        "org": college.id,
                        "name": name,
                        "email": email,
                    },
                )
                assign_role(fb_user.uid, "college", college_id=str(college.id))
                where = college.name
            elif role == "coaching":
                await db.execute(
                    text(
                        """
                        INSERT INTO coaching_center_admins
                            (id, firebase_uid, coaching_center_id, name, email, active)
                        VALUES (:id, :uid, :org, :name, :email, true)
                        ON CONFLICT (firebase_uid) DO UPDATE SET active = true
                        """
                    ),
                    {
                        "id": row_id,
                        "uid": fb_user.uid,
                        "org": centre_id,
                        "name": name,
                        "email": email,
                    },
                )
                assign_role(fb_user.uid, "coaching", coaching_centre_id=str(centre_id))
                where = "Pragati Career Academy"
            else:
                await db.execute(
                    text(
                        """
                        INSERT INTO platform_users
                            (id, firebase_uid, name, email, role, active)
                        VALUES (:id, :uid, :name, :email, 'admin', true)
                        ON CONFLICT (firebase_uid) DO UPDATE SET active = true
                        """
                    ),
                    {"id": row_id, "uid": fb_user.uid, "name": name, "email": email},
                )
                assign_role(fb_user.uid, "admin")
                where = "Platform"

            print(f"{role:9} {email:24} {PASSWORD}   -> {where}")

        await db.commit()

    print()
    print("Students sign themselves up at /signup; there is no seeded student.")


if __name__ == "__main__":
    asyncio.run(main())
