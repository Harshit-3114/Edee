from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    FIREBASE_SERVICE_ACCOUNT_PATH: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()