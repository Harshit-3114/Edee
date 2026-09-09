# Edee Apply – College‑Application Platform (Backend)

> FastAPI service that powers the **Edee Apply** platform: student signup, college search & shortlisting, Razorpay payment, and role‑based admin portals.

---

## 🚀 Tech Stack
| Layer | Technology |
|------|------------|
| **API** | FastAPI 0.115 (async) |
| **DB** | PostgreSQL 16 (asyncpg) |
| **Migrations** | Alembic |
| **Auth** | Firebase Admin SDK (JWT verification) |
| **Payments** | Razorpay (order creation + webhook) |
| **Containerisation** | Docker + docker‑compose |
| **Testing** | pytest / httpx (async) |
| **Code quality** | black, ruff |

---

## 📂 Repository Layout (monorepo‑style)

edee-apply/
├─ backend/                # FastAPI service (this folder)
│   ├─ app/
│   │   ├─ core/          # settings (pydantic‑settings)
│   │   ├─ db/            # SQLAlchemy async engine & Base
│   │   ├─ middleware/    # Firebase JWT auth + role helpers
│   │   ├─ models/        # Pydantic request/response schemas
│   │   ├─ routers/       # /students, /colleges, /shortlists, /payments
│   │   ├─ services/      # Razorpay client, Firebase init
│   │   └─ main.py        # FastAPI entry point
│   ├─ migrations/        # Alembic scripts (phase‑1 schema)
│   ├─ seeds/             # python seeds/colleges.py
│   ├─ tests/             # pytest suite
│   ├─ Dockerfile
│   ├─ requirements.txt
│   ├─ requirements-dev.txt
│   └─ .env.example
├─ docker-compose.yml      # postgres + backend
└─ README.md               # you are here

---

## ⚙️  Local Development (Docker‑first)

> **All commands are run from the repository root** (`edee-apply/`).

### 1. Clone & configure secrets
```bash
git clone https://github.com/<your‑github‑username>/edee-apply.git
cd edee-apply

# copy example env and fill in dummy / real keys
cp backend/.env.example backend/.env
# edit backend/.env → add FIREBASE_SERVICE_ACCOUNT_PATH, RAZORPAY_* values
2. Spin up the stack
docker compose up -d --build          # builds backend image, starts Postgres + API
docker compose ps                     # both services should show “Up / healthy”
3. Run DB migrations & seed data
docker compose exec backend alembic -c /app/alembic.ini upgrade head
docker compose exec backend python seeds/colleges.py
4. Verify
curl http://localhost:8000/health          # → {"status":"ok"}
open http://localhost:8000/docs            # Swagger UI
open http://localhost:8000/redoc           # ReDoc
🧪  Running Tests
docker compose exec backend pytest -q
# or with coverage
docker compose exec backend pytest --cov=app --cov-report=term-missing
📦  Building a Production Image
# builds a lean image (no dev deps, no reload)
docker build -t ghcr.io/<your‑github‑username>/edee-apply-backend:latest -f backend/Dockerfile backend
docker push ghcr.io/<your‑github‑username>/edee-apply-backend:latest
🔐  Environment Variables (backend/.env)
Variable	Description
DATABASE_URL	Async Postgres DSN
FIREBASE_SERVICE_ACCOUNT_PATH	Path to service‑account JSON (mounted in container)
RAZORPAY_KEY_ID	Razorpay Key ID
RAZORPAY_KEY_SECRET	Razorpay Key Secret
RAZORPAY_WEBHOOK_SECRET	Secret used to verify webhook signatures
ENVIRONMENT	development
Never commit real keys – keep them only in .env (git‑ignored) or in your CI/CD secret store.
📚  API Overview (Phase 1)
Area	Endpoints
Students	POST /students/ – create profile <br> GET /students/me – current profile
Colleges	GET /colleges/ – list + filters <br> GET /colleges/{id} – detail
Shortlists	GET /shortlists/ – my shortlist <br> POST /shortlists/ – add <br> DELETE /shortlists/{id} – remove
Payments	POST /payments/create-order – Razorpay order <br> POST /payments/webhook – Razorpay callback
Full OpenAPI spec is served at /openapi.json (Swagger UI at /docs).
🤝  Contributing
1. Fork the repo.  
2. Create a feature branch (git checkout -b feat/awesome).  
3. Run black . && ruff . before committing.  
4. Ensure pytest passes.  
5. Open a Pull Request – CI will run lint + tests automatically.
