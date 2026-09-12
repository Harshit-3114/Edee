# Edee Apply - Backend

FastAPI backend for the Edee Apply college application platform.

## Project Structure

```
backend/
├── app/
│   ├── core/           # Configuration settings, slug helper
│   ├── db/             # Async engine/session factory and ORM Base
│   ├── middleware/     # Firebase JWT auth and role/scope helpers
│   ├── models/         # ORM tables plus Pydantic request/response schemas
│   ├── routers/        # Students, colleges, shortlists, payments, portals
│   ├── services/       # Razorpay client and Firebase role claims
│   └── main.py         # FastAPI application entry point
├── migrations/         # Alembic database migrations
├── seeds/              # Database seed scripts
├── tests/              # Unit tests
├── requirements.txt    # Production dependencies
├── requirements-dev.txt # Development dependencies
├── Dockerfile          # Docker configuration
└── .env.example        # Environment variables template
```

## Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 16
- Docker (optional)

### Local Development

1. Create a virtual environment:
```bash
cd backend
python -m venv venv
```

2. Install dependencies:
```bash
venv\Scripts\python -m pip install -r requirements.txt
venv\Scripts\python -m pip install -r requirements-dev.txt
```

3. Set up environment variables:
```bash
copy .env.example .env
# Edit .env with your configuration.
```

4. Start PostgreSQL from the repository root:
```bash
cd ..
docker compose up -d db
cd backend
```

The Docker database is published on host port `5433`; local development uses
`localhost:5433` in `DATABASE_URL`.

5. Run migrations:
```bash
venv\Scripts\python -m alembic upgrade head
```

6. Seed the database:
```bash
venv\Scripts\python -m seeds.colleges
venv\Scripts\python -m seeds.users  # only with a Firebase service account
```

7. Run the server:
```bash
venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

### Using Docker Compose

```bash
docker compose up -d
```

## API Endpoints

### Students
- `POST /students/` - Create student profile; optional `invite_code`
- `GET /students/me` - Get current student profile
- `PATCH /students/me` - Update name, phone, or stream
- `GET /students/me/applications` - List the student's applications
- `POST /students/me/applications/{application_id}/withdraw` - Withdraw an undecided application

### Colleges
- `GET /colleges/` - List colleges with filtering
- `GET /colleges/{college_id}` - Get college details

### Shortlists
- `GET /shortlists/` - Get student's shortlist
- `POST /shortlists/` - Add to shortlist
- `DELETE /shortlists/{shortlist_id}` - Remove from shortlist

### Payments
- `POST /payments/create-order` - Create Razorpay order
- `POST /payments/verify` - Verify the browser payment handshake
- `POST /payments/webhook` - Razorpay webhook handler

### College portal
- `GET /college/dashboard`
- `GET /college/courses`, `POST /college/courses`
- `GET /college/courses/{course_id}`, `PATCH /college/courses/{course_id}`
- `GET /college/applications`, `GET /college/applications/{application_id}`, `PATCH /college/applications/{application_id}`
- `GET /college/profile`, `PATCH /college/profile`

### Coaching portal
- `GET /coaching/dashboard`
- `GET /coaching/students`, `GET /coaching/students/{student_id}`
- `GET /coaching/invites`, `POST /coaching/invites`
- `GET /coaching/profile`, `PATCH /coaching/profile`

### Admin portal
- `GET /admin/dashboard`
- `GET /admin/colleges`, `POST /admin/colleges`, `GET /admin/colleges/{college_id}`, `PATCH /admin/colleges/{college_id}`
- `GET /admin/coaching-centres`, `POST /admin/coaching-centres`, `PATCH /admin/coaching-centres/{centre_id}`
- `GET /admin/students`
- `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/{user_id}`
- `GET /admin/payments`
- `GET /admin/audit`
- `GET /admin/system` - live checks of the API, database, Firebase, Razorpay

### Health
- `GET /health` — always public; reports `dev_mode` for local tooling

## Dev mode (no Firebase)

With no service account configured in development, the API accepts
self-described bearer tokens instead of Firebase JWTs:

- `dev:student[:tag]`, `dev:admin[:tag]` — the tag makes you a new person
- `dev:college:<college_id>`, `dev:coaching:<centre_id>`

`GET /dev/directory` lists available organisations (dev mode only, 404
otherwise). Role guards, ownership checks and rate limits all keep working —
only the identity source changes. `DEV_MODE=1` forces this on even with keys
present; staging and production refuse to boot with it. Payments are excluded
on purpose: dev mode fakes identity, never money.

## Testing

```bash
venv\Scripts\python -m pytest -q
```

Database-backed tests default to `college_platform_test` on `localhost:5433`
through `TEST_DATABASE_URL`, and each test rebuilds an isolated schema. The
no-database security suite covers role isolation, signatures, transitions, and
configuration.

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| FIREBASE_SERVICE_ACCOUNT_PATH | Path to Firebase service account JSON |
| RAZORPAY_KEY_ID | Razorpay API key ID |
| RAZORPAY_KEY_SECRET | Razorpay API key secret |
| RAZORPAY_WEBHOOK_SECRET | Razorpay webhook secret |
| CORS_ORIGINS | Comma-separated browser origins allowed to call the API |
| ENVIRONMENT | `development`, `test`, `staging`, `production`, or `prod` |
| LOG_LEVEL | `DEBUG`, `INFO`, `WARNING`, or `ERROR` (default `INFO`) |
| DEV_MODE | `1` forces dev mode on even with keys; `0` forces it off even without them; unset auto-detects; refused outside development |

## Code Quality

```bash
# Format code
black .

# Lint
ruff .
```