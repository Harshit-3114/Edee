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
# numbers. Fine on a laptop, a data leak once logs are shipped anywhere.
SQL_ECHO = not settings.is_production and settings.ENVIRONMENT.lower() == "development"
