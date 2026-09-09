from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    FIREBASE_SERVICE_ACCOUNT_PATH: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str
    ENVIRONMENT: str = "development"

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

    class Config:
        env_file = ".env"


settings = Settings()

# SQL echo prints every statement with its parameters - names, emails, phone
# numbers. Fine on a laptop, a data leak once logs are shipped anywhere.
SQL_ECHO = not settings.is_production and settings.ENVIRONMENT.lower() == "development"
