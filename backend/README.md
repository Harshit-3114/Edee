# Edee Apply - Backend

FastAPI backend for the Edee Apply college application platform.

## Project Structure

```
backend/
├── app/
│   ├── core/           # Configuration settings
│   ├── db/             # Database connection and models
│   ├── middleware/     # Auth middleware
│   ├── models/         # Pydantic models for request/response
│   ├── routers/        # API route handlers
│   ├── services/       # External service integrations
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

1. Create virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start PostgreSQL (using Docker):
```bash
docker compose up -d db
```

5. Run migrations:
```bash
alembic upgrade head
```

6. Seed database:
```bash
python seeds/colleges.py
```

7. Run the server:
```bash
uvicorn app.main:app --reload
```

### Using Docker Compose

```bash
docker compose up -d
```

## API Endpoints

### Students
- `POST /students/` - Create student profile
- `GET /students/me` - Get current student profile

### Colleges
- `GET /colleges/` - List colleges with filtering
- `GET /colleges/{college_id}` - Get college details

### Shortlists
- `GET /shortlists/` - Get student's shortlist
- `POST /shortlists/` - Add to shortlist
- `DELETE /shortlists/{shortlist_id}` - Remove from shortlist

### Payments
- `POST /payments/create-order` - Create Razorpay order
- `POST /payments/webhook` - Razorpay webhook handler

## Testing

```bash
pytest tests/ -v
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| FIREBASE_SERVICE_ACCOUNT_PATH | Path to Firebase service account JSON |
| RAZORPAY_KEY_ID | Razorpay API key ID |
| RAZORPAY_KEY_SECRET | Razorpay API key secret |
| RAZORPAY_WEBHOOK_SECRET | Razorpay webhook secret |
| ENVIRONMENT | Environment (development/production) |

## Code Quality

```bash
# Format code
black .

# Lint
ruff .
```