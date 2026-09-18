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
