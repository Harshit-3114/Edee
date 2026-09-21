"""
The local email/password path, end to end.

Most of the suite signs in by overriding get_current_user, which is right for
testing what an endpoint does with an identity but useless for testing how an
identity is established. These tests deliberately do not override it: the
requests here go through the real middleware, so a token that would not work
in production does not work here either.
"""
import time
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core import local_token
from app.db.connection import get_db
from app.main import app
from app.services.passwords import (
    ROUNDS,
    hash_password,
    needs_rehash,
    verify_password,
)

SIGNUP = {
    "name": "Ananya Deshmukh",
    "email": "ananya@example.com",
    "phone": "9876543210",
    "stream": "UG",
    "password": "correct horse battery",
}


@pytest_asyncio.fixture
async def api(db_session):
    """A client whose requests are authenticated by the real middleware."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def make_admin(db, email="admin@edeeapply.in", password="admin-password"):
    """A seeded admin credential, the way seeds/local_admin.py makes one."""
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
    await db.commit()
    return uid


# --------------------------------------------------------------------------
# Hashing
# --------------------------------------------------------------------------


def test_hash_round_trip():
    stored = hash_password("correct horse battery")
    assert stored != "correct horse battery"
    assert stored.startswith("$2b$")
    assert verify_password("correct horse battery", stored)


def test_wrong_password_rejected():
    assert not verify_password("nearly right", hash_password("correct horse battery"))


def test_same_password_hashes_differently():
    """Salted, so two people with the same password do not share a hash."""
    assert hash_password("same input") != hash_password("same input")


def test_malformed_hash_reads_as_no_match():
    """One corrupt row must not 500 every sign-in attempt on the platform."""
    assert not verify_password("anything", "not-a-bcrypt-hash")


def test_oversized_password_rejected_not_truncated():
    """bcrypt stops at 72 bytes; silently truncating would ignore the rest."""
    with pytest.raises(ValueError):
        hash_password("x" * 100)


def test_needs_rehash_spots_a_weaker_cost():
    import bcrypt

    weak = bcrypt.hashpw(b"pw", bcrypt.gensalt(rounds=ROUNDS - 2)).decode()
    assert needs_rehash(weak)
    assert not needs_rehash(hash_password("pw"))


# --------------------------------------------------------------------------
# Tokens
# --------------------------------------------------------------------------


def test_token_round_trip():
    token = local_token.mint(uid="local:abc", role="student", token_version=0)
    claims = local_token.verify(token)
    assert claims["uid"] == "local:abc"
    assert claims["role"] == "student"
    assert claims["tv"] == 0


def test_token_carries_scope():
    token = local_token.mint(
        uid="local:abc", role="college", token_version=3, college_id="college-1"
    )
    assert local_token.verify(token)["college_id"] == "college-1"


def test_tampered_payload_rejected():
    token = local_token.mint(uid="local:abc", role="student", token_version=0)
    prefix, payload, signature = token.split(".")
    forged = f"{prefix}.{payload[:-4]}AAAA.{signature}"
    assert local_token.verify(forged) is None


def test_unsigned_token_rejected():
    """A payload with no valid signature is not a credential."""
    assert local_token.verify("edee1.eyJ1aWQiOiJsb2NhbDp4In0.") is None


def test_expired_token_rejected():
    token = local_token.mint(
        uid="local:abc", role="student", token_version=0, ttl_seconds=-1
    )
    assert local_token.verify(token) is None


def test_garbage_is_not_a_token():
    assert local_token.verify("not a token") is None
    assert not local_token.is_local_token("dev:student")


# --------------------------------------------------------------------------
# Signup
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_signup_creates_credential_and_student(api, db_session):
    res = await api.post("/auth/signup", json=SIGNUP)
    assert res.status_code == 201, res.text
    assert res.json()["role"] == "student"

    row = (
        await db_session.execute(
            text(
                """
                SELECT c.uid, c.password_hash, c.role, s.name
                FROM auth_credentials c
                JOIN students s ON s.firebase_uid = c.uid
                WHERE c.email = :email
                """
            ),
            {"email": SIGNUP["email"]},
        )
    ).fetchone()

    assert row is not None, "credential and student row must be linked by uid"
    assert row.role == "student"
    assert row.uid.startswith("local:")
    # The whole point: what is stored is a hash, and it verifies.
    assert SIGNUP["password"] not in row.password_hash
    assert verify_password(SIGNUP["password"], row.password_hash)


@pytest.mark.asyncio
async def test_signup_token_reaches_the_student_portal(api):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]

    me = await api.get("/auth/me", headers=bearer(token))
    assert me.status_code == 200
    assert me.json()["role"] == "student"

    profile = await api.get("/students/me", headers=bearer(token))
    assert profile.status_code == 200
    assert profile.json()["name"] == SIGNUP["name"]


@pytest.mark.asyncio
async def test_signup_refuses_a_duplicate_email(api):
    await api.post("/auth/signup", json=SIGNUP)
    again = await api.post(
        "/auth/signup", json={**SIGNUP, "phone": "9876500000"}
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_signup_refuses_a_duplicate_phone(api):
    await api.post("/auth/signup", json=SIGNUP)
    again = await api.post(
        "/auth/signup", json={**SIGNUP, "email": "someone.else@example.com"}
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_rejected_signup_leaves_nothing_behind(api, db_session):
    """A refused second signup must not leave an orphan credential."""
    await api.post("/auth/signup", json=SIGNUP)
    await api.post("/auth/signup", json={**SIGNUP, "email": "other@example.com"})

    count = (
        await db_session.execute(text("SELECT count(*) FROM auth_credentials"))
    ).scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_signup_rejects_a_short_password(api):
    res = await api.post("/auth/signup", json={**SIGNUP, "password": "short"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_signup_cannot_ask_for_another_role(api, db_session):
    """There is no role field. Sending one must not grant it."""
    res = await api.post("/auth/signup", json={**SIGNUP, "role": "admin"})
    assert res.status_code == 201
    role = (
        await db_session.execute(
            text("SELECT role FROM auth_credentials WHERE email = :e"),
            {"e": SIGNUP["email"]},
        )
    ).scalar()
    assert role == "student"


# --------------------------------------------------------------------------
# Login
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_with_the_right_password(api):
    await api.post("/auth/signup", json=SIGNUP)
    res = await api.post(
        "/auth/login",
        json={"identifier": SIGNUP["email"], "password": SIGNUP["password"]},
    )
    assert res.status_code == 200
    assert res.json()["role"] == "student"
    assert local_token.verify(res.json()["token"]) is not None


@pytest.mark.asyncio
async def test_login_is_case_insensitive_on_email(api):
    await api.post("/auth/signup", json=SIGNUP)
    res = await api.post(
        "/auth/login",
        json={"identifier": "Ananya@Example.COM", "password": SIGNUP["password"]},
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_login_with_phone_number(api):
    await api.post("/auth/signup", json=SIGNUP)
    res = await api.post(
        "/auth/login",
        json={"identifier": SIGNUP["phone"], "password": SIGNUP["password"]},
    )
    assert res.status_code == 200
    assert res.json()["role"] == "student"
    assert local_token.verify(res.json()["token"]) is not None


@pytest.mark.asyncio
async def test_login_with_formatted_phone_number(api):
    """A +91 prefix, spaces and dashes are stripped before lookup."""
    await api.post("/auth/signup", json=SIGNUP)
    res = await api.post(
        "/auth/login",
        json={"identifier": "+91 98765-43210", "password": SIGNUP["password"]},
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_login_with_unknown_phone_matches_email_failures(api):
    """An unknown number must read exactly like an unknown email."""
    await api.post("/auth/signup", json=SIGNUP)
    unknown_phone = await api.post(
        "/auth/login", json={"identifier": "9000000000", "password": "not it"}
    )
    unknown_email = await api.post(
        "/auth/login", json={"identifier": "nobody@example.com", "password": "not it"}
    )
    assert unknown_phone.status_code == unknown_email.status_code == 401
    assert unknown_phone.json()["detail"] == unknown_email.json()["detail"]


@pytest.mark.asyncio
async def test_login_with_phone_and_wrong_password_fails(api):
    await api.post("/auth/signup", json=SIGNUP)
    res = await api.post(
        "/auth/login", json={"identifier": SIGNUP["phone"], "password": "not it"}
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_says_the_same_thing_for_every_failure(api):
    """Wrong password and no such account must be indistinguishable."""
    await api.post("/auth/signup", json=SIGNUP)

    wrong = await api.post(
        "/auth/login", json={"identifier": SIGNUP["email"], "password": "not it"}
    )
    unknown = await api.post(
        "/auth/login", json={"identifier": "nobody@example.com", "password": "not it"}
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


@pytest.mark.asyncio
async def test_deactivated_account_cannot_sign_in(api, db_session):
    await api.post("/auth/signup", json=SIGNUP)
    await db_session.execute(
        text("UPDATE auth_credentials SET active = false WHERE email = :e"),
        {"e": SIGNUP["email"]},
    )
    await db_session.commit()

    res = await api.post(
        "/auth/login",
        json={"identifier": SIGNUP["email"], "password": SIGNUP["password"]},
    )
    assert res.status_code == 401


# --------------------------------------------------------------------------
# Session lifetime
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_forged_token_is_refused(api):
    """Signed with the wrong secret, so the claims are attacker-chosen."""
    import base64
    import hmac
    import json
    from hashlib import sha256

    claims = {
        "uid": "local:whoever",
        "role": "admin",
        "tv": 0,
        "exp": int(time.time()) + 3600,
    }
    payload = (
        base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    )
    signature = (
        base64.urlsafe_b64encode(
            hmac.new(b"wrong secret", payload.encode(), sha256).digest()
        )
        .decode()
        .rstrip("=")
    )

    res = await api.get("/auth/me", headers=bearer(f"edee1.{payload}.{signature}"))
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_a_token_for_a_deleted_account_is_refused(api, db_session):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    await db_session.execute(text("DELETE FROM students"))
    await db_session.execute(text("DELETE FROM auth_credentials"))
    await db_session.commit()

    assert (await api.get("/auth/me", headers=bearer(token))).status_code == 401


@pytest.mark.asyncio
async def test_signing_out_invalidates_outstanding_tokens(api):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    assert (await api.get("/auth/me", headers=bearer(token))).status_code == 200

    out = await api.delete("/auth/session", headers=bearer(token))
    assert out.status_code == 204

    # Same token, now worthless. This is the guarantee token_version buys.
    assert (await api.get("/auth/me", headers=bearer(token))).status_code == 401


@pytest.mark.asyncio
async def test_deactivating_an_account_takes_effect_immediately(api, db_session):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    await db_session.execute(text("UPDATE auth_credentials SET active = false"))
    await db_session.commit()

    assert (await api.get("/auth/me", headers=bearer(token))).status_code == 403


@pytest.mark.asyncio
async def test_session_endpoint_accepts_a_local_token(api):
    """The SSR cookie path must work for local sessions, not just Firebase."""
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    res = await api.post("/auth/session", headers=bearer(token))
    assert res.status_code == 200
    assert res.json()["session"] == token


@pytest.mark.asyncio
async def test_session_header_authenticates_like_a_bearer(api):
    """What the Next.js server sends when rendering a page."""
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    res = await api.get("/auth/me", headers={"X-Session-Cookie": token})
    assert res.status_code == 200
    assert res.json()["role"] == "student"


# --------------------------------------------------------------------------
# Password change
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_changing_the_password_needs_the_current_one(api):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    res = await api.post(
        "/auth/password",
        headers=bearer(token),
        json={"current_password": "wrong", "password": "a brand new one"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_changing_the_password_drops_other_sessions(api):
    first = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    second = (
        await api.post(
            "/auth/login",
            json={"identifier": SIGNUP["email"], "password": SIGNUP["password"]},
        )
    ).json()["token"]

    changed = await api.post(
        "/auth/password",
        headers=bearer(second),
        json={
            "current_password": SIGNUP["password"],
            "password": "a brand new one",
        },
    )
    assert changed.status_code == 200

    # The session that made the change keeps working, via its fresh token.
    fresh = changed.json()["token"]
    assert (await api.get("/auth/me", headers=bearer(fresh))).status_code == 200
    # Every other one is gone, which is the point of changing it.
    assert (await api.get("/auth/me", headers=bearer(first))).status_code == 401
    assert (await api.get("/auth/me", headers=bearer(second))).status_code == 401

    old = await api.post(
        "/auth/login",
        json={"identifier": SIGNUP["email"], "password": SIGNUP["password"]},
    )
    assert old.status_code == 401


# --------------------------------------------------------------------------
# Staff invites
# --------------------------------------------------------------------------


@pytest_asyncio.fixture
async def admin_token(api, db_session):
    await make_admin(db_session)
    res = await api.post(
        "/auth/login", json={"identifier": "admin@edeeapply.in", "password": "admin-password"}
    )
    assert res.status_code == 200
    return res.json()["token"]


@pytest.mark.asyncio
async def test_admin_invites_a_college_and_it_becomes_an_account(
    api, db_session, admin_token, seed_college
):
    invite = await api.post(
        "/auth/invites",
        headers=bearer(admin_token),
        json={
            "email": "priya@fergusson.edu.in",
            "name": "Priya Nair",
            "role": "college",
            "college_id": seed_college["college_id"],
        },
    )
    assert invite.status_code == 201, invite.text
    token = invite.json()["url"].split("token=")[1]

    detail = await api.get(f"/auth/invites/{token}")
    assert detail.status_code == 200
    assert detail.json()["organisation"] == "Fergusson College"

    accepted = await api.post(
        f"/auth/invites/{token}/accept", json={"password": "a college password"}
    )
    assert accepted.status_code == 201
    assert accepted.json()["role"] == "college"
    assert accepted.json()["college_id"] == seed_college["college_id"]

    # The staff row exists and is keyed by the same uid as the credential.
    linked = (
        await db_session.execute(
            text(
                """
                SELECT a.name FROM college_admins a
                JOIN auth_credentials c ON c.uid = a.firebase_uid
                WHERE c.email = :email
                """
            ),
            {"email": "priya@fergusson.edu.in"},
        )
    ).fetchone()
    assert linked is not None and linked.name == "Priya Nair"

    signed_in = await api.post(
        "/auth/login",
        json={"identifier": "priya@fergusson.edu.in", "password": "a college password"},
    )
    assert signed_in.status_code == 200
    assert signed_in.json()["role"] == "college"


@pytest.mark.asyncio
async def test_an_invite_works_once(api, admin_token, seed_college):
    invite = await api.post(
        "/auth/invites",
        headers=bearer(admin_token),
        json={
            "email": "priya@fergusson.edu.in",
            "name": "Priya Nair",
            "role": "college",
            "college_id": seed_college["college_id"],
        },
    )
    token = invite.json()["url"].split("token=")[1]

    assert (
        await api.post(f"/auth/invites/{token}/accept", json={"password": "first go"})
    ).status_code == 201
    replayed = await api.post(
        f"/auth/invites/{token}/accept", json={"password": "second go"}
    )
    assert replayed.status_code == 404


@pytest.mark.asyncio
async def test_an_expired_invite_is_refused(api, db_session, admin_token, seed_college):
    invite = await api.post(
        "/auth/invites",
        headers=bearer(admin_token),
        json={
            "email": "priya@fergusson.edu.in",
            "name": "Priya Nair",
            "role": "college",
            "college_id": seed_college["college_id"],
        },
    )
    token = invite.json()["url"].split("token=")[1]
    await db_session.execute(
        text("UPDATE auth_invites SET expires_at = now() - interval '1 day'")
    )
    await db_session.commit()

    assert (await api.get(f"/auth/invites/{token}")).status_code == 404


@pytest.mark.asyncio
async def test_only_an_admin_can_issue_invites(api, seed_college):
    student = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    res = await api.post(
        "/auth/invites",
        headers=bearer(student),
        json={
            "email": "priya@fergusson.edu.in",
            "name": "Priya Nair",
            "role": "college",
            "college_id": seed_college["college_id"],
        },
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_an_invite_cannot_mint_an_admin(api, admin_token, seed_college):
    """Students sign up and admins are seeded. Invites make staff, nothing more."""
    res = await api.post(
        "/auth/invites",
        headers=bearer(admin_token),
        json={"email": "sneaky@example.com", "name": "Sneaky", "role": "admin"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_an_invite_needs_an_organisation(api, admin_token):
    res = await api.post(
        "/auth/invites",
        headers=bearer(admin_token),
        json={"email": "priya@example.com", "name": "Priya", "role": "college"},
    )
    assert res.status_code == 400


# --------------------------------------------------------------------------
# The guards still hold for local identities
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_student_cannot_reach_a_college_endpoint(api):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    assert (
        await api.get("/college/applications", headers=bearer(token))
    ).status_code == 403


@pytest.mark.asyncio
async def test_a_student_cannot_reach_the_admin_portal(api):
    token = (await api.post("/auth/signup", json=SIGNUP)).json()["token"]
    assert (await api.get("/admin/students", headers=bearer(token))).status_code == 403


@pytest.mark.asyncio
async def test_a_college_account_is_scoped_to_its_own_college(
    api, admin_token, seed_college
):
    """The scope in the claims comes from the row, so ownership still works."""
    invite = await api.post(
        "/auth/invites",
        headers=bearer(admin_token),
        json={
            "email": "priya@fergusson.edu.in",
            "name": "Priya Nair",
            "role": "college",
            "college_id": seed_college["college_id"],
        },
    )
    token = invite.json()["url"].split("token=")[1]
    staff = (
        await api.post(f"/auth/invites/{token}/accept", json={"password": "a password"})
    ).json()["token"]

    me = await api.get("/auth/me", headers=bearer(staff))
    assert me.json()["college_id"] == seed_college["college_id"]
    assert (
        await api.get("/college/applications", headers=bearer(staff))
    ).status_code == 200
