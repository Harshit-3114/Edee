# College Application Platform — Development Stack & Process

**Phase 1 scope:** Student signup, college search & shortlisting, Razorpay payment  
**Stack:** FastAPI · Next.js · PostgreSQL · Firebase Auth · Razorpay  
**Target:** 35,000 students (UG + PG), Mumbai-region AWS deployment

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Prerequisites](#2-prerequisites)
3. [Environment Setup](#3-environment-setup)
4. [Database](#4-database)
5. [Backend — FastAPI](#5-backend--fastapi)
6. [Frontend — Next.js](#6-frontend--nextjs)
7. [Firebase Auth](#7-firebase-auth)
8. [Razorpay Integration](#8-razorpay-integration)
9. [Local Development Workflow](#9-local-development-workflow)
10. [API Reference — Phase 1](#10-api-reference--phase-1)
11. [Database Schema — Phase 1](#11-database-schema--phase-1)
12. [Testing](#12-testing)
13. [Git Workflow](#13-git-workflow)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Phase 2 Additions (reference)](#15-phase-2-additions-reference)

---

## 1. Repository Structure

Monorepo. One repository, two top-level packages. Never cross-import between backend and frontend at the code level — they communicate only via HTTP.

```
college-platform/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── students.py
│   │   │   ├── colleges.py
│   │   │   ├── shortlists.py
│   │   │   └── payments.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── student.py
│   │   │   ├── college.py
│   │   │   ├── shortlist.py
│   │   │   └── payment.py
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── connection.py
│   │   │   └── tables.py
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   └── auth.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── razorpay.py
│   │   │   └── firebase.py
│   │   └── main.py
│   ├── migrations/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_phase1_initial.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_students.py
│   │   ├── test_colleges.py
│   │   ├── test_shortlists.py
│   │   └── test_payments.py
│   ├── seeds/
│   │   └── colleges.py
│   ├── .env
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── (student)/
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   ├── colleges/
│   │   │   │   └── page.tsx
│   │   │   ├── shortlist/
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx
│   │   │   └── dashboard/
│   │   │       └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/
│   │   │   ├── PhoneOTPForm.tsx
│   │   │   └── GoogleSignIn.tsx
│   │   ├── colleges/
│   │   │   ├── CollegeCard.tsx
│   │   │   ├── CollegeFilters.tsx
│   │   │   └── CollegeSearch.tsx
│   │   ├── shortlist/
│   │   │   └── ShortlistButton.tsx
│   │   └── payment/
│   │       └── CheckoutSummary.tsx
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── api.ts
│   │   └── types.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useShortlist.ts
│   ├── .env.local
│   ├── .env.local.example
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 2. Prerequisites

Install these once on your machine before anything else.

### Required

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| Docker Desktop | Latest | [docker.com](https://docker.com) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

### Recommended

| Tool | Purpose | Install |
|---|---|---|
| `pyenv` | Manage Python versions | `brew install pyenv` / [pyenv.run](https://pyenv.run) |
| `nvm` | Manage Node versions | [nvm.sh](https://github.com/nvm-sh/nvm) |
| ngrok | Expose localhost for Razorpay webhooks | `npm install -g ngrok` |
| Postman or Bruno | API testing | [postman.com](https://postman.com) |

### Verify installs

```bash
python --version       # 3.11+
node --version         # v20+
docker --version       # 24+
git --version
```

---

## 3. Environment Setup

### Clone and initialise

```bash
git clone git@github.com:your-org/college-platform.git
cd college-platform
```

### Backend Python environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate — Mac/Linux
source venv/bin/activate

# Activate — Windows
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

**`requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
alembic==1.13.3
pydantic==2.9.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
firebase-admin==6.5.0
razorpay==1.4.1
httpx==0.27.2
python-multipart==0.0.12
```

**`requirements-dev.txt`**

```
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.27.2
pytest-cov==5.0.0
black==24.8.0
ruff==0.6.0
```

### Frontend Node environment

```bash
cd frontend

# Install dependencies
npm install
```

**`package.json` dependencies**

```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "18.3.0",
    "react-dom": "18.3.0",
    "typescript": "5.5.0",
    "firebase": "10.13.0",
    "axios": "1.7.0",
    "tailwindcss": "3.4.0"
  },
  "devDependencies": {
    "@types/react": "18.3.0",
    "@types/node": "20.0.0",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.0"
  }
}
```

### Start the database

```bash
# From repo root
docker compose up -d

# Verify it is running
docker ps
# Should show: college-platform-db running on 0.0.0.0:5432
```

**`docker-compose.yml`**

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    container_name: college-platform-db
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: college_platform
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d college_platform"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

---

## 4. Database

### Alembic setup

```bash
cd backend

# Initialise Alembic (already done if cloning existing repo)
alembic init migrations

# Apply all migrations to local database
alembic upgrade head

# Create a new migration after changing tables.py
alembic revision --autogenerate -m "describe what changed"
alembic upgrade head
```

### Migration file — Phase 1 initial schema

**`migrations/versions/001_phase1_initial.py`**

```python
"""phase1 initial schema

Revision ID: 001
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

revision = '001'
down_revision = None


def upgrade():
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # Students
    op.create_table('students',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('firebase_uid', sa.Text, unique=True, nullable=False),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('email', sa.Text, unique=True, nullable=False),
        sa.Column('phone', sa.Text, unique=True, nullable=False),
        sa.Column('stream', sa.Text, nullable=False),  # 'UG' or 'PG'
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_check_constraint('stream_check', 'students',
                               "stream IN ('UG', 'PG')")

    # Colleges
    op.create_table('colleges',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('location', sa.Text, nullable=False),
        sa.Column('city', sa.Text, nullable=False),
        sa.Column('state', sa.Text, nullable=False),
        sa.Column('type', sa.Text, nullable=False),  # private/government/deemed
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    # College courses
    op.create_table('college_courses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('course_name', sa.Text, nullable=False),
        sa.Column('stream', sa.Text, nullable=False),  # 'UG' or 'PG'
        sa.Column('duration_years', sa.Integer),
        sa.Column('seats', sa.Integer),
        sa.Column('application_fee', sa.Integer, nullable=False),  # paise
        sa.Column('active', sa.Boolean, default=True),
    )

    # Shortlists
    op.create_table('shortlists',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('course_id', UUID(as_uuid=True),
                  sa.ForeignKey('college_courses.id'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint('student_id', 'college_id', 'course_id',
                            name='uq_shortlist'),
    )

    # Payment orders
    op.create_table('orders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('razorpay_order_id', sa.Text, unique=True, nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),  # total paise
        sa.Column('currency', sa.Text, default='INR'),
        sa.Column('status', sa.Text, default='created'),  # created/paid/failed
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    # Payment confirmations
    op.create_table('payments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('order_id', UUID(as_uuid=True),
                  sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('razorpay_payment_id', sa.Text, unique=True, nullable=False),
        sa.Column('razorpay_signature', sa.Text, nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('status', sa.Text, default='captured'),
        sa.Column('verified_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    # Idempotency table — prevents duplicate webhook processing
    op.create_table('processed_webhooks',
        sa.Column('razorpay_payment_id', sa.Text, primary_key=True),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )

    # Applications — created on payment confirmation
    op.create_table('applications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('student_id', UUID(as_uuid=True),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('college_id', UUID(as_uuid=True),
                  sa.ForeignKey('colleges.id'), nullable=False),
        sa.Column('course_id', UUID(as_uuid=True),
                  sa.ForeignKey('college_courses.id'), nullable=False),
        sa.Column('payment_id', UUID(as_uuid=True),
                  sa.ForeignKey('payments.id')),
        sa.Column('status', sa.Text, default='payment_received'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint('student_id', 'college_id', 'course_id',
                            name='uq_application'),
    )

    # Audit log — append only, never update or delete
    op.create_table('audit_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('actor_id', UUID(as_uuid=True)),
        sa.Column('actor_role', sa.Text),
        sa.Column('action', sa.Text, nullable=False),
        sa.Column('entity_type', sa.Text),
        sa.Column('entity_id', UUID(as_uuid=True)),
        sa.Column('metadata', JSONB),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('audit_events')
    op.drop_table('applications')
    op.drop_table('processed_webhooks')
    op.drop_table('payments')
    op.drop_table('orders')
    op.drop_table('shortlists')
    op.drop_table('college_courses')
    op.drop_table('colleges')
    op.drop_table('students')
```

### Seed colleges

Run once after migrations to populate test data:

```bash
cd backend
python seeds/colleges.py
```

**`seeds/colleges.py`**

```python
"""
Seed script — populates colleges and courses for local development.
Run: python seeds/colleges.py
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

COLLEGES = [
    {
        "name": "VIT Chennai",
        "location": "Chennai, Tamil Nadu",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "type": "private",
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 150000, "seats": 120},
            {"name": "B.Tech Electronics", "stream": "UG", "fee": 150000, "seats": 60},
            {"name": "M.Tech Computer Science", "stream": "PG", "fee": 200000, "seats": 30},
        ]
    },
    {
        "name": "SRM Institute of Science and Technology",
        "location": "Chennai, Tamil Nadu",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "type": "private",
        "courses": [
            {"name": "B.Tech Computer Science (AI/ML)", "stream": "UG", "fee": 135000, "seats": 90},
            {"name": "B.Tech Information Technology", "stream": "UG", "fee": 125000, "seats": 60},
            {"name": "MBA Technology Management", "stream": "PG", "fee": 180000, "seats": 45},
        ]
    },
    {
        "name": "Manipal Institute of Technology",
        "location": "Manipal, Karnataka",
        "city": "Manipal",
        "state": "Karnataka",
        "type": "private",
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 200000, "seats": 150},
            {"name": "B.Tech Mechanical Engineering", "stream": "UG", "fee": 185000, "seats": 90},
        ]
    },
    {
        "name": "PSG College of Technology",
        "location": "Coimbatore, Tamil Nadu",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "private",
        "courses": [
            {"name": "B.E. Computer Science", "stream": "UG", "fee": 80000, "seats": 60},
            {"name": "B.E. Electronics and Communication", "stream": "UG", "fee": 80000, "seats": 60},
            {"name": "M.E. Computer Science", "stream": "PG", "fee": 100000, "seats": 18},
        ]
    },
    {
        "name": "Amrita Vishwa Vidyapeetham",
        "location": "Coimbatore, Tamil Nadu",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "deemed",
        "courses": [
            {"name": "B.Tech Computer Science", "stream": "UG", "fee": 160000, "seats": 120},
            {"name": "M.Tech Data Science", "stream": "PG", "fee": 175000, "seats": 30},
        ]
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for college_data in COLLEGES:
            college_id = uuid.uuid4()
            await session.execute(text("""
                INSERT INTO colleges (id, name, location, city, state, type, active)
                VALUES (:id, :name, :location, :city, :state, :type, true)
                ON CONFLICT DO NOTHING
            """), {
                "id": college_id,
                "name": college_data["name"],
                "location": college_data["location"],
                "city": college_data["city"],
                "state": college_data["state"],
                "type": college_data["type"],
            })

            for course in college_data["courses"]:
                await session.execute(text("""
                    INSERT INTO college_courses
                        (id, college_id, course_name, stream, application_fee, seats, active)
                    VALUES (:id, :college_id, :name, :stream, :fee, :seats, true)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": uuid.uuid4(),
                    "college_id": college_id,
                    "name": course["name"],
                    "stream": course["stream"],
                    "fee": course["fee"],  # stored in rupees for seed, convert to paise in API
                    "seats": course["seats"],
                })

        await session.commit()
        print(f"Seeded {len(COLLEGES)} colleges")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
```

---

## 5. Backend — FastAPI

### Entry point

**`app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.connection import init_db
from app.routers import auth, students, colleges, shortlists, payments


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="College Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router,   prefix="/students",   tags=["students"])
app.include_router(colleges.router,   prefix="/colleges",   tags=["colleges"])
app.include_router(shortlists.router, prefix="/shortlists", tags=["shortlists"])
app.include_router(payments.router,   prefix="/payments",   tags=["payments"])


@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Database connection

**`app/db/connection.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=2,           # keep small — PgBouncer handles multiplexing
    max_overflow=3,
    pool_timeout=10,
    pool_pre_ping=True,    # detect stale connections
    pool_recycle=1800,
    echo=settings.ENVIRONMENT == "development",
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    # Called on app startup — confirms DB is reachable
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: None)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### Settings

**`app/core/config.py`**

```python
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
```

### Auth middleware

**`app/middleware/auth.py`**

```python
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
import firebase_admin
from firebase_admin import credentials
from app.core.config import settings
import functools

# Initialise Firebase Admin once at import time
_cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(_cred)

bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
) -> dict:
    """
    Validates Firebase JWT on every request.
    Returns the decoded token claims.
    Raises 401 if token is invalid or expired.
    """
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")


def require_role(role: str):
    """
    Decorator to restrict endpoints by role claim in JWT.
    Usage: Depends(require_role("student"))
    """
    async def _check(user: dict = Depends(get_current_user)):
        if user.get("role") != role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _check
```

### Students router

**`app/routers/students.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.student import StudentCreate, StudentResponse
import uuid

router = APIRouter()


@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(
    body: StudentCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called after Firebase phone OTP / Google OAuth succeeds.
    Creates the student record in our database.
    """
    firebase_uid = user["uid"]

    # Check if student already exists (idempotent)
    existing = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": firebase_uid}
    )
    row = existing.fetchone()
    if row:
        raise HTTPException(status_code=409, detail="Student already registered")

    student_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO students (id, firebase_uid, name, email, phone, stream)
        VALUES (:id, :firebase_uid, :name, :email, :phone, :stream)
    """), {
        "id": student_id,
        "firebase_uid": firebase_uid,
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "stream": body.stream,
    })
    await db.commit()

    return {"id": student_id, "name": body.name, "stream": body.stream}


@router.get("/me", response_model=StudentResponse)
async def get_me(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id, name, email, phone, stream FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    return dict(row._mapping)
```

### Colleges router

**`app/routers/colleges.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from typing import Optional

router = APIRouter()


@router.get("/")
async def list_colleges(
    stream: Optional[str] = Query(None, description="UG or PG"),
    state: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns colleges with their courses.
    Filterable by stream, state, and name search.
    """
    conditions = ["c.active = true"]
    params = {"limit": limit, "offset": offset}

    if stream:
        conditions.append("cc.stream = :stream")
        params["stream"] = stream
    if state:
        conditions.append("c.state = :state")
        params["state"] = state
    if search:
        conditions.append("c.name ILIKE :search")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    result = await db.execute(text(f"""
        SELECT
            c.id           AS college_id,
            c.name         AS college_name,
            c.city,
            c.state,
            c.type,
            cc.id          AS course_id,
            cc.course_name,
            cc.stream,
            cc.seats,
            cc.application_fee
        FROM colleges c
        JOIN college_courses cc ON cc.college_id = c.id AND cc.active = true
        WHERE {where}
        ORDER BY c.name, cc.course_name
        LIMIT :limit OFFSET :offset
    """), params)

    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]
```

### Shortlists router

**`app/routers/shortlists.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.shortlist import ShortlistAdd
import uuid

router = APIRouter()


async def _get_student_id(user: dict, db: AsyncSession) -> uuid.UUID:
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return row[0]


@router.get("/")
async def get_shortlist(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)
    result = await db.execute(text("""
        SELECT
            s.id AS shortlist_id,
            c.name AS college_name,
            c.city, c.state,
            cc.course_name,
            cc.stream,
            cc.application_fee,
            s.college_id,
            s.course_id
        FROM shortlists s
        JOIN colleges c ON c.id = s.college_id
        JOIN college_courses cc ON cc.id = s.course_id
        WHERE s.student_id = :student_id
        ORDER BY s.created_at DESC
    """), {"student_id": student_id})

    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


@router.post("/", status_code=201)
async def add_to_shortlist(
    body: ShortlistAdd,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)

    try:
        await db.execute(text("""
            INSERT INTO shortlists (id, student_id, college_id, course_id)
            VALUES (:id, :student_id, :college_id, :course_id)
        """), {
            "id": uuid.uuid4(),
            "student_id": student_id,
            "college_id": body.college_id,
            "course_id": body.course_id,
        })
        await db.commit()
    except Exception:
        # Unique constraint violation — already shortlisted
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already shortlisted")

    return {"message": "Added to shortlist"}


@router.delete("/{shortlist_id}", status_code=204)
async def remove_from_shortlist(
    shortlist_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = await _get_student_id(user, db)

    result = await db.execute(text("""
        DELETE FROM shortlists
        WHERE id = :id AND student_id = :student_id
    """), {"id": shortlist_id, "student_id": student_id})
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Shortlist entry not found")
```

### Payments router

**`app/routers/payments.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.models.payment import CreateOrder, VerifyPayment
from app.services.razorpay import razorpay_client, verify_webhook_signature
from app.core.config import settings
import uuid
import json

router = APIRouter()


@router.post("/create-order")
async def create_order(
    body: CreateOrder,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a Razorpay order for the selected shortlist items.
    Amount = sum of application fees for selected courses.
    """
    result = await db.execute(
        text("SELECT id FROM students WHERE firebase_uid = :uid"),
        {"uid": user["uid"]}
    )
    student = result.fetchone()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_id = student[0]

    # Fetch fees for selected shortlist items
    result = await db.execute(text("""
        SELECT cc.application_fee
        FROM shortlists s
        JOIN college_courses cc ON cc.id = s.course_id
        WHERE s.id = ANY(:ids) AND s.student_id = :student_id
    """), {"ids": body.shortlist_ids, "student_id": student_id})

    fees = result.fetchall()
    if not fees:
        raise HTTPException(status_code=400, detail="No valid shortlist items")

    total_paise = sum(row[0] * 100 for row in fees)  # convert rupees to paise

    # Create Razorpay order
    rz_order = razorpay_client.order.create({
        "amount": total_paise,
        "currency": "INR",
        "receipt": f"order_{uuid.uuid4().hex[:8]}",
    })

    # Store order in DB
    order_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO orders (id, student_id, razorpay_order_id, amount, status)
        VALUES (:id, :student_id, :razorpay_order_id, :amount, 'created')
    """), {
        "id": order_id,
        "student_id": student_id,
        "razorpay_order_id": rz_order["id"],
        "amount": total_paise,
    })
    await db.commit()

    return {
        "order_id": rz_order["id"],
        "amount": total_paise,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives Razorpay payment events.
    MUST return 200 in under 5 seconds.
    Verifies signature then processes synchronously for Phase 1.
    Phase 3+: hand off to SQS immediately, return 200, process async.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Step 1: verify signature — fast, no DB, no network
    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    event = json.loads(body)

    if event.get("event") != "payment.captured":
        return {"status": "ignored"}

    payment_entity = event["payload"]["payment"]["entity"]
    razorpay_payment_id = payment_entity["id"]
    razorpay_order_id = payment_entity["order_id"]
    razorpay_signature = signature
    amount = payment_entity["amount"]

    # Step 2: idempotency check — insert into processed_webhooks
    try:
        await db.execute(text("""
            INSERT INTO processed_webhooks (razorpay_payment_id)
            VALUES (:payment_id)
        """), {"payment_id": razorpay_payment_id})
    except Exception:
        # Already processed — return 200 so Razorpay stops retrying
        await db.rollback()
        return {"status": "already_processed"}

    # Step 3: fetch the order
    result = await db.execute(text("""
        SELECT id, student_id FROM orders
        WHERE razorpay_order_id = :order_id
    """), {"order_id": razorpay_order_id})
    order = result.fetchone()
    if not order:
        await db.rollback()
        return {"status": "order_not_found"}

    order_id, student_id = order

    # Step 4: record payment
    payment_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO payments
            (id, order_id, razorpay_payment_id, razorpay_signature, amount)
        VALUES (:id, :order_id, :razorpay_payment_id, :signature, :amount)
    """), {
        "id": payment_id,
        "order_id": order_id,
        "razorpay_payment_id": razorpay_payment_id,
        "signature": razorpay_signature,
        "amount": amount,
    })

    # Step 5: update order status
    await db.execute(text("""
        UPDATE orders SET status = 'paid' WHERE id = :id
    """), {"id": order_id})

    # Step 6: create application records for each shortlisted item in this order
    shortlists = await db.execute(text("""
        SELECT s.id, s.college_id, s.course_id
        FROM shortlists s
        JOIN orders o ON o.student_id = s.student_id
        WHERE o.id = :order_id
    """), {"order_id": order_id})

    for row in shortlists.fetchall():
        try:
            await db.execute(text("""
                INSERT INTO applications
                    (id, student_id, college_id, course_id, payment_id, status)
                VALUES (:id, :student_id, :college_id, :course_id, :payment_id,
                        'payment_received')
                ON CONFLICT (student_id, college_id, course_id) DO NOTHING
            """), {
                "id": uuid.uuid4(),
                "student_id": student_id,
                "college_id": row[1],
                "course_id": row[2],
                "payment_id": payment_id,
            })
        except Exception:
            pass  # conflict — application already exists

    await db.commit()
    return {"status": "ok"}
```

### Razorpay service

**`app/services/razorpay.py`**

```python
import razorpay
import hmac
import hashlib
from app.core.config import settings

razorpay_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verifies Razorpay webhook signature using HMAC-SHA256.
    body: raw request body bytes
    signature: X-Razorpay-Signature header value
    """
    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### Pydantic models

**`app/models/student.py`**

```python
from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Literal


class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    stream: Literal["UG", "PG"]


class StudentResponse(BaseModel):
    id: UUID
    name: str
    stream: str
```

**`app/models/shortlist.py`**

```python
from pydantic import BaseModel
from uuid import UUID


class ShortlistAdd(BaseModel):
    college_id: UUID
    course_id: UUID
```

**`app/models/payment.py`**

```python
from pydantic import BaseModel
from uuid import UUID
from typing import List


class CreateOrder(BaseModel):
    shortlist_ids: List[UUID]
```

---

## 6. Frontend — Next.js

### Next.js config

**`next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // All API calls go to FastAPI backend, not Next.js API routes
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

### API client

**`lib/api.ts`**

```typescript
import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Attach Firebase JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Firebase client

**`lib/firebase.ts`**

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
export default app;
```

### Auth hook

**`hooks/useAuth.ts`**

```typescript
import { useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
```

### Signup page

**`app/(student)/signup/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function SignupPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [error, setError] = useState('');
  const router = useRouter();
  const auth = getAuth();

  async function sendOTP() {
    try {
      const recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, recaptcha);
      setConfirmationResult(result);
      setStep('otp');
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function verifyOTP() {
    try {
      await confirmationResult.confirm(otp);
      router.push('/profile');
    } catch (e: any) {
      setError('Invalid OTP');
    }
  }

  async function googleSignIn() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/profile');
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create account</h1>

        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-500 text-sm">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-r-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9876543210"
                />
              </div>
            </div>
            <button
              onClick={sendOTP}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Send OTP
            </button>
            <div id="recaptcha-container" />
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
            <button
              onClick={googleSignIn}
              className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Continue with Google
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">OTP sent to +91 {phone}</p>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg"
              placeholder="000000"
            />
            <button
              onClick={verifyOTP}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Verify OTP
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Change number
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
```

### Colleges page

**`app/(student)/colleges/page.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import CollegeCard from '@/components/colleges/CollegeCard';
import CollegeFilters from '@/components/colleges/CollegeFilters';

interface Course {
  college_id: string;
  college_name: string;
  city: string;
  state: string;
  type: string;
  course_id: string;
  course_name: string;
  stream: string;
  seats: number;
  application_fee: number;
}

export default function CollegesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stream, setStream] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchColleges();
  }, [stream, search]);

  async function fetchColleges() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stream) params.append('stream', stream);
      if (search) params.append('search', search);
      const { data } = await api.get(`/colleges?${params}`);
      setCourses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Find colleges</h1>

      <CollegeFilters
        stream={stream}
        onStreamChange={setStream}
        search={search}
        onSearchChange={setSearch}
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4 mt-6">
          {courses.map((course) => (
            <CollegeCard key={course.course_id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Checkout page with Razorpay

**`app/(student)/checkout/page.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface ShortlistItem {
  shortlist_id: string;
  college_name: string;
  course_name: string;
  application_fee: number;
}

export default function CheckoutPage() {
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadShortlist();
    loadRazorpayScript();
  }, []);

  async function loadShortlist() {
    const { data } = await api.get('/shortlists');
    setItems(data);
    setSelected(new Set(data.map((i: ShortlistItem) => i.shortlist_id)));
  }

  function loadRazorpayScript() {
    if (document.getElementById('razorpay-script')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);
  }

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function totalAmount() {
    return items
      .filter(i => selected.has(i.shortlist_id))
      .reduce((sum, i) => sum + i.application_fee, 0);
  }

  async function handlePayment() {
    if (selected.size === 0) return;
    setLoading(true);

    try {
      // Create order on backend
      const { data } = await api.post('/payments/create-order', {
        shortlist_ids: Array.from(selected),
      });

      // Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: 'College Application Platform',
        description: `Application fees for ${selected.size} course(s)`,
        handler: function () {
          // Payment successful — backend webhook handles the rest
          router.push('/dashboard?payment=success');
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      });

      rzp.open();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="space-y-3 mb-6">
        {items.map((item) => (
          <label
            key={item.shortlist_id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(item.shortlist_id)}
                onChange={() => toggleItem(item.shortlist_id)}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.college_name}
                </p>
                <p className="text-xs text-gray-500">{item.course_name}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-900">
              ₹{item.application_fee.toLocaleString('en-IN')}
            </span>
          </label>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-4 mb-6">
        <div className="flex justify-between text-base font-semibold text-gray-900">
          <span>Total ({selected.size} applications)</span>
          <span>₹{totalAmount().toLocaleString('en-IN')}</span>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || selected.size === 0}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : `Pay ₹${totalAmount().toLocaleString('en-IN')}`}
      </button>
    </div>
  );
}
```

---

## 7. Firebase Auth

### Firebase Console setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create new project
3. Go to **Authentication** → **Sign-in method**
4. Enable: **Phone**, **Google**
5. Go to **Project Settings** → **General** → **Your apps** → Add web app
6. Copy the config object into `frontend/.env.local`
7. Go to **Project Settings** → **Service accounts** → **Generate new private key**
8. Save the downloaded JSON as `backend/firebase-service-account.json`
9. Add `firebase-service-account.json` to `.gitignore` immediately

### Activate Blaze plan

Firebase phone OTP requires the Blaze (pay-as-you-go) plan. Spark free plan blocks it silently in production. Upgrade at: **Project Settings** → **Usage and billing** → **Modify plan**.

---

## 8. Razorpay Integration

### Test mode setup

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Stay in **Test Mode** (toggle top-right of dashboard)
3. Go to **Settings** → **API Keys** → Generate test keys
4. Copy `Key ID` and `Key Secret` to `backend/.env`
5. Copy `Key ID` only to `frontend/.env.local` as `NEXT_PUBLIC_RAZORPAY_KEY_ID`

### Configure webhook for local testing

```bash
# Install and authenticate ngrok
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Expose local backend
ngrok http 8000
# Copy the https URL, e.g. https://abc123.ngrok-free.app
```

In Razorpay dashboard:
1. **Settings** → **Webhooks** → **Add new webhook**
2. URL: `https://abc123.ngrok-free.app/payments/webhook`
3. Secret: any string, copy to `backend/.env` as `RAZORPAY_WEBHOOK_SECRET`
4. Events: check **payment.captured**

### Test payment cards

| Card number | Network | Result |
|---|---|---|
| 4111 1111 1111 1111 | Visa | Success |
| 5267 3181 8797 5449 | Mastercard | Success |
| Any UPI ID | UPI | Success (test mode) |

Use any future expiry, any 3-digit CVV, any name.

---

## 9. Local Development Workflow

### Starting everything

```bash
# Terminal 1 — Database
docker compose up -d

# Terminal 2 — Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend
npm run dev

# Terminal 4 — ngrok (for webhook testing)
ngrok http 8000
```

### URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| API docs (ReDoc) | http://localhost:8000/redoc |
| Database | localhost:5432 |

### Development order

Build and verify in this exact sequence. Do not skip ahead.

1. **Database up** — `docker compose up -d`, verify with `docker ps`
2. **Run migrations** — `alembic upgrade head`
3. **Seed colleges** — `python seeds/colleges.py`
4. **Backend running** — `uvicorn app.main:app --reload`
5. **Test backend via Swagger** — open `localhost:8000/docs`, test every endpoint manually before touching the frontend
6. **Firebase configured** — service account in place, `.env` updated
7. **Test auth flow** — call `POST /students/` via Swagger with a valid Firebase token
8. **Frontend running** — `npm run dev`
9. **Test full flow in browser** — signup → profile → colleges → shortlist → checkout → payment

### Getting a Firebase token for Swagger testing

Firebase does not give you tokens from a CLI directly. Quickest method for local testing:

```javascript
// Run this in browser console after Firebase is initialised
const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
const token = await getAuth().currentUser.getIdToken();
console.log(token);
// Paste this into Swagger "Authorize" → Bearer {token}
```

Or write a small test script:

```python
# backend/scripts/get_test_token.py
# Uses Firebase REST API with email/password test user
import requests, os
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("FIREBASE_WEB_API_KEY")
resp = requests.post(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}",
    json={"email": "test@example.com", "password": "testpass123", "returnSecureToken": True}
)
print(resp.json()["idToken"])
```

---

## 10. API Reference — Phase 1

### Base URL (local)
`http://localhost:8000`

### Authentication
All endpoints except `/health` require:
`Authorization: Bearer {firebase_jwt_token}`

---

### Students

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/students/` | Create student profile after Firebase auth |
| `GET` | `/students/me` | Get current student's profile |

**POST /students/** request body:
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "stream": "UG"
}
```

---

### Colleges

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/colleges/` | List colleges with courses |

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `stream` | string | `UG` or `PG` |
| `state` | string | Filter by state |
| `search` | string | Search by college name |
| `limit` | int | Default 20, max 100 |
| `offset` | int | Pagination offset |

---

### Shortlists

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/shortlists/` | Get student's shortlist |
| `POST` | `/shortlists/` | Add college/course to shortlist |
| `DELETE` | `/shortlists/{id}` | Remove from shortlist |

**POST /shortlists/** request body:
```json
{
  "college_id": "uuid",
  "course_id": "uuid"
}
```

---

### Payments

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/payments/create-order` | Create Razorpay order for selected items |
| `POST` | `/payments/webhook` | Razorpay webhook receiver |

**POST /payments/create-order** request body:
```json
{
  "shortlist_ids": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "order_id": "order_xxxxx",
  "amount": 45000,
  "currency": "INR",
  "key_id": "rzp_test_xxxx"
}
```

---

## 11. Database Schema — Phase 1

```
students
  id              UUID  PK
  firebase_uid    TEXT  UNIQUE
  name            TEXT
  email           TEXT  UNIQUE
  phone           TEXT  UNIQUE
  stream          TEXT  CHECK IN ('UG','PG')
  created_at      TIMESTAMPTZ

colleges
  id              UUID  PK
  name            TEXT
  location        TEXT
  city            TEXT
  state           TEXT
  type            TEXT  (private/government/deemed)
  active          BOOLEAN
  created_at      TIMESTAMPTZ

college_courses
  id              UUID  PK
  college_id      UUID  FK → colleges.id
  course_name     TEXT
  stream          TEXT  CHECK IN ('UG','PG')
  duration_years  INT
  seats           INT
  application_fee INT   (rupees)
  active          BOOLEAN

shortlists
  id              UUID  PK
  student_id      UUID  FK → students.id
  college_id      UUID  FK → colleges.id
  course_id       UUID  FK → college_courses.id
  created_at      TIMESTAMPTZ
  UNIQUE(student_id, college_id, course_id)

orders
  id                  UUID  PK
  student_id          UUID  FK → students.id
  razorpay_order_id   TEXT  UNIQUE
  amount              INT   (paise)
  currency            TEXT  DEFAULT 'INR'
  status              TEXT  (created/paid/failed)
  created_at          TIMESTAMPTZ

payments
  id                    UUID  PK
  order_id              UUID  FK → orders.id
  razorpay_payment_id   TEXT  UNIQUE
  razorpay_signature    TEXT
  amount                INT   (paise)
  status                TEXT  DEFAULT 'captured'
  verified_at           TIMESTAMPTZ

processed_webhooks
  razorpay_payment_id   TEXT  PK   ← idempotency

applications
  id              UUID  PK
  student_id      UUID  FK → students.id
  college_id      UUID  FK → colleges.id
  course_id       UUID  FK → college_courses.id
  payment_id      UUID  FK → payments.id
  status          TEXT  DEFAULT 'payment_received'
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE(student_id, college_id, course_id)

audit_events
  id              UUID  PK
  actor_id        UUID
  actor_role      TEXT
  action          TEXT
  entity_type     TEXT
  entity_id       UUID
  metadata        JSONB
  created_at      TIMESTAMPTZ
```

---

## 12. Testing

### Backend tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=term-missing

# Single file
pytest tests/test_payments.py -v
```

**`tests/conftest.py`**

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.db.connection import get_db

TEST_DB_URL = "postgresql+asyncpg://dev:dev@localhost:5432/college_platform_test"

@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession)
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()

@pytest_asyncio.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()
```

### Test coverage targets

| Module | Target |
|---|---|
| Payment webhook verification | 100% — no exceptions |
| Shortlist idempotency | 100% — test duplicate add |
| Application creation | 100% — test payment → application |
| College search filters | 80%+ |
| Auth middleware | 80%+ |

---

## 13. Git Workflow

### Branch strategy

```
main          ← production only. Never commit directly.
staging       ← pre-production testing
dev           ← integration branch
feature/*     ← individual features
fix/*         ← bug fixes
```

### Branch naming

```bash
git checkout -b feature/student-signup
git checkout -b feature/college-search
git checkout -b feature/razorpay-checkout
git checkout -b fix/webhook-duplicate-handling
```

### Commit message format

```
feat: add phone OTP signup flow
fix: prevent duplicate webhook processing
chore: add Alembic migration for phase 1 schema
docs: update API reference for payments endpoint
test: add payment webhook idempotency tests
```

### PR rules

- Every PR requires at least one review before merging to `dev`
- CI must pass: lint (ruff/eslint) + tests
- No direct commits to `main` or `staging`
- PR description must include: what changed, how to test, any env var changes

### GitHub Actions CI (minimal)

**`.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [dev, staging]
  pull_request:
    branches: [dev, staging, main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: dev
          POSTGRES_PASSWORD: dev
          POSTGRES_DB: college_platform_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
      - run: cd backend && ruff check app/
      - run: cd backend && pytest --cov=app
        env:
          DATABASE_URL: postgresql+asyncpg://dev:dev@localhost:5432/college_platform_test
          FIREBASE_SERVICE_ACCOUNT_PATH: ./tests/mock-service-account.json
          RAZORPAY_KEY_ID: rzp_test_mock
          RAZORPAY_KEY_SECRET: mock_secret
          RAZORPAY_WEBHOOK_SECRET: mock_webhook_secret

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build
```

---

## 14. Environment Variables Reference

### Backend — `backend/.env`

```env
# Database
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5432/college_platform

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx

# App
ENVIRONMENT=development
```

### Frontend — `frontend/.env.local`

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Razorpay — KEY ID only, never the secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx

# Firebase — all NEXT_PUBLIC, these are safe to expose
NEXT_PUBLIC_FIREBASE_API_KEY=xxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxxx
```

### `.gitignore`

```gitignore
# Backend secrets
backend/.env
backend/firebase-service-account.json
backend/__pycache__/
backend/venv/
backend/.venv/
backend/.pytest_cache/
backend/.ruff_cache/
backend/htmlcov/

# Frontend secrets
frontend/.env.local
frontend/node_modules/
frontend/.next/
frontend/out/

# Database volumes
pgdata/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
```

---

## 15. Phase 2 Additions (reference)

Not built now. Listed here so Phase 1 schema and architecture do not need to change when Phase 2 begins.

### What gets added

- DigiLocker OAuth flow in `/app/routers/documents.py`
- `student_documents` table (Phase 2 migration)
- S3 client in `/app/services/s3.py`
- Full application form fields as JSONB column on `applications`
- Separate `ug_eligibility` and `pg_eligibility` tables (entrance scores per stream)
- SQS FIFO queue replaces synchronous webhook processing
- Fargate async worker service replaces Lambda
- SES email templates for confirmation and status updates

### Phase 2 new tables

```sql
student_documents
  id              UUID PK
  student_id      UUID FK → students.id
  doc_type        TEXT  (marksheet_10/marksheet_12/degree/scorecard)
  s3_key          TEXT
  digilocker_ref  TEXT
  status          TEXT  (pending/fetched/verified/deleted)
  expires_at      TIMESTAMPTZ  ← 30 days post terminal state
  created_at      TIMESTAMPTZ

ug_eligibility
  id              UUID PK
  student_id      UUID FK → students.id
  board           TEXT
  percentage_10   DECIMAL
  percentage_12   DECIMAL
  entrance_exam   TEXT  (JEE/NEET/state_cet)
  rank            INT
  percentile      DECIMAL

pg_eligibility
  id              UUID PK
  student_id      UUID FK → students.id
  graduation_cgpa DECIMAL
  entrance_exam   TEXT  (CAT/GATE/NEET_PG/MAT)
  score           DECIMAL
  percentile      DECIMAL
  rank            INT
```

Phase 1 schema does not need to change. Phase 2 adds new tables via new Alembic migrations only.

---

*Document version: Phase 1 — September 2026*  
*Next review: before Phase 2 kickoff*
