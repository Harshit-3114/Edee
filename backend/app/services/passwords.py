"""
Password hashing for the local sign-in path.

bcrypt directly, not passlib. Passlib is unmaintained and its bcrypt backend
raises against bcrypt 4.x; the `bcrypt` package is what it would have wrapped
anyway, and the API here is three functions.

Nothing in this module knows about roles, requests or the database. It turns a
password into a hash and checks one against the other, which is the whole job.
"""
import bcrypt

# Work factor. 12 costs a few hundred milliseconds per hash: slow enough that
# an offline attack on a leaked table is expensive, fast enough that a sign-in
# does not feel stalled. Raising it later is safe - needs_rehash() below spots
# credentials still stored at the old cost.
ROUNDS = 12

# bcrypt hashes at most 72 bytes and, since 4.0, raises rather than silently
# truncating. Bytes, not characters: one emoji is four of them. Enforced here
# so the limit is a validation error at the edge instead of a 500 from inside
# the hasher.
MAX_PASSWORD_BYTES = 72

# Long enough to be worth hashing. Everything above this is the user's
# business; the 72-byte ceiling is the only hard limit.
MIN_PASSWORD_LENGTH = 8


def hash_password(password: str) -> str:
    """Hash a password for storage. Raises ValueError if it cannot be hashed."""
    raw = password.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {MAX_PASSWORD_BYTES} bytes long"
        )
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=ROUNDS)).decode("ascii")


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Does this password match the stored hash?

    Returns False rather than raising on anything malformed. A corrupt hash in
    one row must read as "wrong password" for that account, not as a 500 on
    every sign-in attempt the platform receives.
    """
    raw = password.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, stored_hash.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    """
    True when this hash was made at a lower cost than ROUNDS.

    Call it after a successful verify: that is the only moment the plaintext
    is available to rehash with, so it is the only chance to upgrade an old
    credential without making the user reset anything.
    """
    # Shape is $2b$<rounds>$<22 char salt><31 char digest>.
    parts = stored_hash.split("$")
    if len(parts) < 4:
        return True
    try:
        return int(parts[2]) < ROUNDS
    except ValueError:
        return True
