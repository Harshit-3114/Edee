"""
Root conftest.

pytest imports this before anything under tests/, which is the only point early
enough to set configuration: app.core.config builds Settings at import time, so
by the time a test module runs it is already too late.

These are obvious fakes on purpose. A test run that silently picks up real
Razorpay keys from a developer's .env is a test run that can move money.
"""
import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://dev:dev@localhost:5432/college_platform_test"
)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", "./nonexistent-test.json")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_key")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "test_secret")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "webhook_secret")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("ENVIRONMENT", "test")
