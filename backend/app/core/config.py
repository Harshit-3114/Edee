from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    DATABASE_URL: str
    FIREBASE_SERVICE_ACCOUNT_PATH: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    # Dev mode override. 1 forces dev mode on (dev: tokens accepted) even
    # with Firebase keys; 0 forces it off even without them. Unset means
    # auto-detect (dev mode when no service account is configured in
    # development). Local development only: staging/production refuse to
    # boot with it set to 1.
    DEV_MODE: Optional[bool] = None

    # Signs the session tokens the local email/password path issues (see
    # app/core/local_token.py). Unrelated to Firebase: it exists so the
    # platform can authenticate people while no service account is
    # configured. Staging and production refuse to boot without it;
    # development falls back to a public constant with a warning.
    AUTH_SECRET: str = ""

    # Seeded admin account for the local path, so a fresh database has one way
    # in. seeds/local_admin.py refuses to run in production regardless.
    #
    # A real domain, not a .test one: POST /auth/login validates the address
    # with email-validator, which refuses special-use domains (.test, .invalid,
    # .localhost). A seeded admin nobody can sign in as is not a seed.
    # Must be set via environment variable.
    SEED_ADMIN_EMAIL: str
    SEED_ADMIN_PASSWORD: str

    # How long a college or coaching set-password link stays usable. Long
    # enough to survive a weekend and an admin forwarding it on, short enough
    # that a link left in an inbox is not a permanent way in.
    INVITE_TTL_DAYS: int = 14

    # How long a minted session cookie stays valid. Firebase allows 5 minutes
    # to 14 days. Eight hours covers a working day; the frontend's two-hour
    # idle logout is what ends an unattended session sooner, and this is the
    # hard ceiling behind it.
    SESSION_MAX_AGE_SECONDS: int = 8 * 60 * 60

    # SQL echo prints every statement with its parameters. Off by default:
    # the per-request log line already shows method, path, and latency.
    # Set SQL_ECHO=1 only when debugging a specific query.
    SQL_ECHO: bool = False

    # Comma-separated. Never "*": this API sends credentials, and a wildcard
    # origin with credentials is how a signed-in student's data gets read by
    # any site they happen to visit.
    CORS_ORIGINS: str = "http://localhost:3000"

    # Public site origin, for absolute links inside emails. Must be the pages
    # students open, not this API: nobody clicks through to /docs from mail.
    PUBLIC_URL: str = "http://localhost:3000"

    # Outbound email (transactional: decisions, receipts, invites, alerts).
    # Empty SMTP_HOST disables sending: development logs instead of mailing,
    # and every send is best-effort anyway (see app/services/email.py).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Edee Apply <no-reply@edeeapply.in>"
    SMTP_STARTTLS: bool = True

    # Platform inbox for operational alerts (contact-form arrivals). Empty
    # means no alert mails; the admin inbox page still lists everything.
    ADMIN_EMAIL: str = ""

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod"}

    @field_validator("SESSION_MAX_AGE_SECONDS")
    @classmethod
    def _firebase_session_bounds(cls, value: int) -> int:
        # Firebase rejects anything outside this range at mint time; catching
        # it at boot beats discovering it on somebody's first sign-in.
        if not (5 * 60 <= value <= 14 * 24 * 60 * 60):
            raise ValueError(
                "SESSION_MAX_AGE_SECONDS must be between 5 minutes and 14 days"
            )
        return value

    @field_validator("ENVIRONMENT")
    @classmethod
    def _known_environment(cls, value: str) -> str:
        allowed = {"development", "test", "staging", "production", "prod"}
        if value.lower() not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {sorted(allowed)}")
        return value

    @field_validator("LOG_LEVEL")
    @classmethod
    def _known_log_level(cls, value: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR"}
        if value.upper() not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(allowed)}")
        return value.upper()

    class Config:
        env_file = ".env"


settings = Settings()

# SQL echo prints every statement with its parameters - names, emails, phone
# numbers. Off unless SQL_ECHO=1: a data leak once logs are shipped anywhere.
SQL_ECHO = settings.SQL_ECHO and not settings.is_production
