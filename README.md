# Edee Apply – College-Application Platform

> FastAPI service plus a Next.js frontend: student signup, college search and
> shortlisting, Razorpay payment, student withdrawal, coaching invites, and
> four role-based portals.

**Repository layout**

```
backend/    FastAPI, PostgreSQL, Alembic
frontend/   Next.js 15, TypeScript, Tailwind v4
start.bat   Windows one-command setup and launch
```

## Quick start

On Windows, run:

```bat
start.bat
```

`start.bat` checks for Docker, Python, and Node; starts Docker Desktop if needed;
removes a stale `college-platform-db` container; starts Postgres; creates
`backend\venv` and `frontend\node_modules` only when missing; copies `.env`
files only when missing; waits for Postgres health; runs migrations and college
seeds; seeds demo accounts only when a Firebase service account exists; then
opens backend and frontend server windows and waits until both respond.

Manual setup:

```bash
# 1. Database
docker compose up -d db

# 2. Backend
cd backend
python -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env                             # fill in Firebase and Razorpay
venv\Scripts\python -m alembic upgrade head
venv\Scripts\python -m seeds.colleges
venv\Scripts\python -m seeds.users                 # only with a Firebase service account
venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd ..\frontend
npm ci
copy .env.local.example .env.local                 # fill in the Firebase web config
npm run dev
```

| | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Student portal | http://localhost:3000/student/dashboard |
| College portal | http://localhost:3000/college/dashboard |
| Coaching portal | http://localhost:3000/coaching/dashboard |
| Admin portal | http://localhost:3000/admin/dashboard |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs (hidden in production) |
| Docker Postgres | 127.0.0.1:5433 |

The Docker database intentionally uses host port `5433`, not `5432`, so it does
not collide with a locally installed PostgreSQL. Inside Docker Compose, backend
services still reach it as `db:5432`; local development uses `localhost:5433`.

`docker compose up` starts all three services from the repository root.

## How the two halves fit together

The frontend never decides what a user may do; it decides what to *show*. Three
layers stand between a request and the data, and only the last one is security:

1. `frontend/middleware.ts` reads a `portal_role` cookie at the edge and
   redirects before the wrong bundle is fetched. The cookie is client-written
   and forgeable — a routing hint, not proof.
2. `RoleGate` re-checks the role against the verified Firebase token.
3. **The API** verifies the JWT and the row-level scope on every request.

A forged cookie therefore gets a rendered shell and a wall of 403s.

Portal endpoints take **no** `college_id` or `coaching_centre_id` parameter.
The backend reads the scope from the token, which is what stops one college
querying another's applicants.

**Money is paise on the wire.** `college_courses.application_fee` is stored in
rupees; every endpoint converts at the edge so the API, the checkout, and
Razorpay all speak one unit.

## Development without Firebase (dev mode)

When the backend has no Firebase service account (and `ENVIRONMENT` is
development), it runs in **dev mode**: the login page offers developer
quick sign-in, and any well-formed `dev:` token works — no Firebase project
needed. `GET /health` reports it (`dev_mode: true`), and `start.bat` prints
a banner when it detects it.

- Tokens look like `dev:student[:tag]`, `dev:admin`, `dev:college:<id>`,
  `dev:coaching:<id>`. The tag makes you a different student.
- `GET /dev/directory` (dev mode only, otherwise 404) lists colleges and
  centres to sign in as.
- `DEV_MODE=1` in `backend/.env` (or `NEXT_PUBLIC_DEV_MODE=1` for the panel)
  forces dev mode even with keys configured, while `DEV_MODE=0` forces it off
  even without them; unset means auto-detect. Both are refused outside
  development: staging and production fail to boot with them.
- Dev mode fakes identity, never money: payments still need real Razorpay
  credentials.

See [SECURITY-FIXES.md](SECURITY-FIXES.md) for the audit carried out during the
integration, including two issues that were giving away free applications.

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
| **Testing** | pytest / httpx (backend, 175 tests) · Vitest (frontend, 88 tests) |
| **Code quality** | black, ruff, ESLint, `tsc --noEmit` |

---

## 📂 Repository Layout

```text
edee/
├─ backend/
│  ├─ app/
│  │  ├─ core/          # settings, slug helper
│  │  ├─ db/            # async engine/session factory, ORM Base
│  │  ├─ middleware/    # Firebase JWT auth + role/scope helpers
│  │  ├─ models/        # ORM tables + Pydantic request/response schemas
│  │  ├─ routers/       # students, colleges, shortlists, payments, portals
│  │  ├─ services/      # Razorpay client, Firebase role claims
│  │  └─ main.py        # FastAPI entry point
│  ├─ migrations/        # Alembic 001–002
│  ├─ seeds/             # colleges, demo role accounts
│  ├─ tests/             # pytest suite
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ requirements-dev.txt
│  └─ .env.example
├─ frontend/             # Next.js portals, components, hooks, tests
├─ docker-compose.yml    # Postgres + backend + frontend
├─ start.bat             # Windows setup and launch
└─ README.md             # you are here
```

---

## ⚙️ Local development and verification

All Compose commands run from the repository root.

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health          # → {"status":"ok"}
```

Backend checks:

```bash
cd backend
venv\Scripts\python -m pytest -q
```

Frontend checks:

```bash
cd ../frontend
npm run test
npm run typecheck
npm run lint
```

Database-backed backend tests use `college_platform_test` on `localhost:5433`
by default and rebuild an isolated schema for each test.

## 📦 Production

Development uses `docker-compose.yml` alone. Production adds the overlay,
which switches to the prod Dockerfiles, drops bind mounts and `--reload`,
restarts services unless stopped, and health-checks the backend and frontend:

```bash
cp .env.prod.example .env   # repo root; every value is required
# place backend/firebase-service-account.json (gitignored, never committed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  alembic -c /app/alembic.ini upgrade head
```

`ENVIRONMENT=production` hides `/docs`, enables HSTS, and silences SQL echo.
Before pointing traffic at it, work through this list:

- **TLS first.** HSTS tells browsers to refuse plain HTTP, so terminate TLS at
  a reverse proxy in front of `127.0.0.1:8000` (API) and `127.0.0.1:3000`
  (web). Without a proxy the HSTS header is a lie.
- **CORS.** `CORS_ORIGINS` must be the exact production origin(s). The dev
  default (`localhost:3000`) would break the live site.
- **Razorpay.** In the Razorpay dashboard, point the webhook at
  `https://<api-host>/payments/webhook` and set `RAZORPAY_WEBHOOK_SECRET` to
  the same secret. The handler rejects amount mismatches and replays, but it
  can only verify what you configured.
- **Firebase.** Add the production web origin to Authorized Domains, and keep
  the service-account JSON out of git (it is ignored) and readable only by
  the backend container.
- **Frontend rebuilds.** `NEXT_PUBLIC_*` values bake in at image build time.
  Changing the API URL or Firebase project means rebuilding the frontend
  image, not just restarting it.
- **Database.** `pgdata` holds everything; back it up
  (`docker exec college-platform-db pg_dump -U dev college_platform > backup.sql`)
  and practice restoring it before you need to. Run migrations explicitly as
  above — the app never migrates itself on boot.
- **Rate limits.** Signup (5/min) and order creation (10/min) are limited
  per client IP in memory, which is exact for one backend replica. Past one
  replica, enforce limits at the ingress or move slowapi to Redis; behind a
  proxy, run uvicorn with `--proxy-headers` so the limiter sees real client
  IPs. The Razorpay webhook is intentionally unlimited (the provider retries).
- **Workers.** The image runs one uvicorn worker. To scale, add `--workers N`
  to the backend command; each worker owns its own small pool
  (`app/db/connection.py`), so grow Postgres `max_connections` to match.
- **CI.** `.github/workflows/ci.yml` runs backend tests against Postgres 16,
  frontend tests/typecheck/lint, and builds both images plus a prod compose
  validation on every push and PR.

## 🚢 Releases and deploys

- **CD** (`.github/workflows/cd.yml`) builds versioned backend/frontend images
  on every push to `main` and every `v*` tag and pushes them to GHCR. The
  frontend build needs seven repository **Variables** (`NEXT_PUBLIC_API_URL`
  plus the six `NEXT_PUBLIC_FIREBASE_*` values); the job fails with their
  names if any is unset.
- **Deploy** (`.github/workflows/deploy.yml`) is manual: pick an image tag and
  run it. It copies the compose files to the server, pulls the tag, migrates,
  and restarts. One-time setup and required secrets are documented at the top
  of that file; prefer holding the secrets in a `production` environment with
  required reviewers.
- **Rollback** is choosing the previous tag and running Deploy again —
  migrations only ever move forward, so keep them backwards-compatible
  (additive changes; no destructive rewrites without a plan).

## 📖 Dev-guide conformance

`college-platform-dev-guide (1).md` is the original spec; the code follows it
except where review found a better answer:

| Guide | Implementation |
|---|---|
| Route groups `(student)` / `(platform-admin)` / … and roles `platform_admin` / … | `/student`, `/admin`, `/college`, `/coaching` with `student`, `admin`, `college`, `coaching` — same four portals, shorter names |
| One `/login` per portal | Single `/login`; post-auth routing by role claim lands each user in exactly one portal |
| Scope from a per-request DB lookup (`get_admissions_scope`) | Scope from verified token claims, with `check_revoked` and claim-clearing revocation; portal routers take no org id from callers |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` in frontend env | Key id comes from `POST /payments/create-order` — one source of truth, survives rotation |
| Python 3.11 / Node 20 / DB on 5432 | Python 3.12 / Node 22 / Docker DB on host 5433 (avoids local Postgres clashes) |
| `tests/mock-service-account.json` | Tests use an intentionally nonexistent path so a run can never touch real credentials |
| Phase-1 routers as sketched | Hardened per `SECURITY-FIXES.md` (order items, amount checks, idempotency, transition table, invite redemption, withdrawal) |

## 🔐 Environment variables

Backend `.env`:

```text
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5433/college_platform
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CORS_ORIGINS=http://localhost:3000
ENVIRONMENT=development
LOG_LEVEL=INFO
```

Frontend `.env.local` only contains publishable `NEXT_PUBLIC_*` values. Never put
Razorpay secrets or Firebase service-account credentials there.

## 📚 API overview

Students:

- `POST /students/` — create profile; optional `invite_code` links a coaching centre
- `GET /students/me`, `PATCH /students/me`
- `GET /students/me/applications`
- `POST /students/me/applications/{application_id}/withdraw`

Browse and shortlist:

- `GET /colleges/`, `GET /colleges/{college_id}`
- `GET /colleges/by-slug/{slug}` — public landing-page lookup, no login
- `GET /shortlists/`, `POST /shortlists/`, `DELETE /shortlists/{shortlist_id}`

Payments:

- `POST /payments/create-order`
- `POST /payments/verify`
- `POST /payments/webhook`

Portals:

- College: `/college/dashboard`, `/college/courses/*`, `/college/applications/*`, `/college/profile`
- Coaching: `/coaching/dashboard`, `/coaching/students/*`, `/coaching/invites`, `/coaching/profile`
- Admin: `/admin/dashboard`, `/admin/colleges/*`, `/admin/coaching-centres`, `/admin/students`, `/admin/users`, `/admin/payments`, `/admin/audit`, `/admin/system` (live dependency checks for the status page)

Every response carries `X-Request-ID`; the backend logs one line per request
at INFO (health checks at DEBUG), so a user report maps to a single grep.

Full OpenAPI is served at `/openapi.json`; Swagger UI is at `/docs` outside production.

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch (`git checkout -b feat/awesome`).
3. Run `ruff check` (backend), backend `pytest -q`, frontend `npm run test`, `npm run typecheck`, and `npm run lint`.
4. Open a pull request; CI should run lint and tests.
