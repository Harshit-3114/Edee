"""
The one account a fresh database needs: a platform admin with a password.

    python -m seeds.local_admin

Deliberately only the admin. Students sign themselves up, and college and
coaching accounts are issued by an admin as invite links from inside the
portal - so seeding those too would be seeding accounts with known passwords
that nobody asked for. One way in is enough; everything else is created
through the product.

Separate from seeds/users.py, which does the same job through Firebase and
cannot run without a service account. This one needs nothing but the database,
which is the whole point of the local sign-in path.

Refuses to run in production: a known password on a real deployment is not a
seed, it is a back door.
"""
import asyncio
import os
import sys
import uuid

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
from app.db.connection import get_session_factory  # noqa: E402
from app.services.passwords import hash_password  # noqa: E402

NAME = "Platform Admin"


async def main() -> None:
    if settings.is_production:
        raise SystemExit("Refusing to seed an account with a known password in production")

    email = settings.SEED_ADMIN_EMAIL.lower().strip()
    password = settings.SEED_ADMIN_PASSWORD

    async with get_session_factory()() as db:
        existing = (
            await db.execute(
                text("SELECT uid FROM auth_credentials WHERE email = :email"),
                {"email": email},
            )
        ).fetchone()

        if existing:
            # Re-running resets the password rather than erroring. That is the
            # useful behaviour for a seed: it is how you get back in after
            # forgetting what you set SEED_ADMIN_PASSWORD to.
            await db.execute(
                text(
                    """
                    UPDATE auth_credentials
                    SET password_hash = :hash,
                        password_changed_at = now(),
                        active = true,
                        token_version = token_version + 1
                    WHERE email = :email
                    """
                ),
                {"hash": hash_password(password), "email": email},
            )
            uid = existing.uid
            action = "reset"
        else:
            uid = f"local:{uuid.uuid4()}"
            await db.execute(
                text(
                    """
                    INSERT INTO auth_credentials (id, uid, email, password_hash, role)
                    VALUES (:id, :uid, :email, :hash, 'admin')
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "uid": uid,
                    "email": email,
                    "hash": hash_password(password),
                },
            )
            action = "created"

        # The platform_users row is what the admin portal lists; the credential
        # is only how somebody signs in. Both, or the account exists and is
        # invisible.
        await db.execute(
            text(
                """
                INSERT INTO platform_users (id, firebase_uid, name, email, role, active)
                VALUES (:id, :uid, :name, :email, 'admin', true)
                ON CONFLICT (firebase_uid) DO UPDATE SET active = true
                """
            ),
            {"id": uuid.uuid4(), "uid": uid, "name": NAME, "email": email},
        )
        await db.commit()

    print(f"admin {action}: {email} / {password}")
    print("Sign in at /login?portal=admin, then issue invites for colleges and centres.")


if __name__ == "__main__":
    asyncio.run(main())
