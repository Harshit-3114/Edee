# Edee Apply – College-Application Platform

> FastAPI service plus a Next.js frontend: student signup, college search and
> shortlisting, Razorpay payment, student withdrawal, coaching invites,
> functional contact form with admin inbox, and four role-based portals.

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
seeds; seeds the local admin, and the Firebase demo accounts only when a
service account exists; then
opens backend and frontend server windows and waits until both respond.

Manual setup:

```bash
# 1. Database
docker compose up -d db

# 2. Backend
cd backend
python -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env                             # set AUTH_SECRET; Firebase optional
venv\Scripts\python -m alembic upgrade head
venv\Scripts\python -m seeds.colleges
venv\Scripts\python -m seeds.local_admin           # the one account a fresh database needs
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
| Admin inbox | http://localhost:3000/admin/inbox |
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

1. `frontend/proxy.ts` (Next.js 16's name for middleware) reads a
   `portal_role` cookie at the edge and redirects before the wrong bundle is
   fetched. The cookie is client-written and forgeable — a routing hint, not
   proof. It also turns a signed-in visitor away from `/login` and `/signup`.
2. The portal layout asks the API who the session cookie belongs to and passes
   the answer to `RoleGate`, which opens on the first paint when it matches.
   This only ever *shortens* the wait; it never widens access.
3. `RoleGate` re-checks the role against the verified credential in the
   browser — a Firebase token or a signed local session token — and redirects
   if it disagrees with either of the above.
4. **The API** verifies the credential and the row-level scope on every
   request.

A forged cookie therefore gets a rendered shell and a wall of 403s.

Portal endpoints take **no** `college_id` or `coaching_centre_id` parameter.
The backend reads the scope from the token, which is what stops one college
querying another's applicants.

**Money is paise on the wire.** `college_courses.application_fee` is stored in
rupees; every endpoint converts at the edge so the API, the checkout, and
Razorpay all speak one unit.

## Two ways to sign in

Identity used to be Firebase's entirely, which meant that with no service
account configured nobody could sign in at all. There are now two paths, and
they run side by side:

| | Email + password | Firebase |
|---|---|---|
| Works without a service account | yes | no |
| Where the password lives | `auth_credentials.password_hash`, bcrypt cost 12 | Firebase's servers |
| Credential | `edee1.<payload>.<hmac>`, signed by this API | ID token / session cookie |
| Available to | staff portals permanently; students only until Firebase is configured | students (Google, phone OTP) |
| Revocation | `token_version` on the row | `check_revoked=True` |

Both produce the same claims (`uid`, `role`, `college_id`,
`coaching_centre_id`), so every guard, ownership query and `RoleGate` behaves
identically whichever one signed you in. Local accounts get a `uid` of
`local:<uuid>` written into the existing `firebase_uid` columns — the column
name stays because it becomes accurate again the day a service account
arrives.

Student password sign-in is a stopgap until the Firebase keys arrive: with no
Firebase project configured the student portal signs in with email or mobile
number plus password, and the day Firebase is configured that form disappears
for students (Google/OTP take over, and `/signup` becomes profile completion
only). Staff portals keep email and password permanently — it is the only
method they have. The backend endpoints stay either way; only the UI gates.

**Only the student portal has signup.** `POST /auth/signup` is the one
endpoint on the platform where a stranger can create an account, and it is
hard-coded to students — there is no role field in the body to ask for
anything else. College and coaching accounts are issued by an admin as a
single-use set-password link (`/set-password?token=…`); the account does not
exist until the recipient opens it and chooses a password, so an invite sent
to the wrong address cannot become an account by itself. Only the sha256 of
the invite token is stored. The admin account is seeded:

```bash
cd backend && python -m seeds.local_admin   # refuses to run in production
```

Sign-in failures all return the same "Email or password is incorrect",
whether the account is missing, the password is wrong, or the account is
deactivated — and an unknown address is still checked against a throwaway
hash, so response time does not answer "does this person have an account
here" either.

`AUTH_SECRET` signs the local session tokens. Staging and production refuse
to boot without it.

## Session cookies and server rendering

A Firebase ID token lives in browser IndexedDB, so a React Server Component —
which runs before any JavaScript does — cannot read it. Every portal page used
to render empty and fetch its own data after hydration, which is why they all
showed skeletons.

Signing in now also trades that ID token for a **session cookie**:

```
browser ──idToken──▶ /auth/session (Next route handler, same origin)
                         └──Bearer idToken──▶ POST /auth/session (FastAPI)
                                                  └─ verifies, mints a Firebase
                                                     session cookie
browser ◀── Set-Cookie: edee_session (httpOnly, SameSite=Lax, Secure)
```

Three properties are load-bearing:

- **The cookie is set on the Next.js origin, never the API's.** The browser
  therefore never attaches it to a FastAPI request by itself. Only this app's
  server can present it, in an explicit `X-Session-Cookie` header — which is
  what makes the server-rendering path free of cross-site request forgery by
  construction rather than by a token check we would have to keep correct.
- **It is a session cookie, not a parked ID token.** An ID token lasts an hour
  and cannot be revoked, so stashing one in a cookie hands an attacker a full
  hour on a stolen session. `verify_session_cookie(check_revoked=True)` rejects
  a session the moment the account's refresh tokens are revoked.
- **It is httpOnly.** No script — ours or an injected one — can read it.

`lib/serverApi.ts` is the only thing that reads it. `serverGet` fetches as the
current user with `cache: 'no-store'`; `publicGet` sends no credential at all
and is deliberately a separate function, so the difference is visible at the
call site. Both return `null` on any failure and never throw: server rendering
is an optimisation over a client fetch that already works, and the client half
loads the data itself if the server could not. A lapsed session degrades to the
old behaviour instead of an error page.

`Authorization: Bearer <id token>` still works everywhere and is what the
browser's own `api` client uses. The two credentials are verified by two
different Firebase calls and are not interchangeable.

## Caching

Cache policy is split by audience, in `frontend/next.config.ts`:

| Routes | `Cache-Control` |
|---|---|
| `/`, `/about`, `/why-us`, `/contact`, `/colleges` | `public, max-age=0, s-maxage=3600, stale-while-revalidate=86400` |
| `/colleges/:slug` | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` — an admin edit must reach the landing page, so the edge holds it only briefly |
| `/student/*`, `/college/*`, `/coaching/*`, `/admin/*`, `/login`, `/signup`, `/auth/*` | `private, no-store` + `Vary: Cookie` |

Public pages render identically for every viewer — the account menu resolves in
the browser — so nothing personal can sit in a shared cache. Anything behind a
portal is one person's data and is never stored by a CDN, a proxy, or the back
button.

Public pages also opt out of link prefetching, so a visitor downloads a page
when they ask for it rather than every page they might visit.

Note that `/colleges` renders per request rather than at build time. It fetches
the catalogue on the server, and prerendering would run that fetch during
`next build` — in CI and the Docker image build, where the API is unreachable —
freezing an empty catalogue into the page.

## Development without Firebase (dev mode)

Email and password sign-in works with no Firebase at all and in every
environment — see [Two ways to sign in](#two-ways-to-sign-in). That is the
realistic path on a laptop without keys, and dev mode is no longer needed for
it.

Dev mode remains for the case it was built for: throwaway identities that
create and destroy their own data. When the backend has no Firebase service
account (and `ENVIRONMENT` is development), it runs in **dev mode**, and
`GET /health` reports it (`dev_mode: true`). `start.bat` prints a banner when
it detects it. There is no separate developer panel on the login page: the
email/password form accepts any email and password in dev mode and signs you
into whichever portal you picked. A real credential still signs in through the
normal path first; anything else provisions a mock user for that portal behind
the scenes (the first college or centre for staff portals), so every page has
working rows behind it.

- **Mock payments walk the real path.** Checkout totals tick up from the
  same pricing code; the dev pay button then runs the same fulfillment as
  the Razorpay webhook (same applications, audit rows, notifications) with
  `dev_`-tagged rows that can never be mistaken for money. The dashboard
  confirms with a dev-mode note.
- **Mock users are idempotent and process-scoped.** Signing in twice with the
  same email reuses the same rows instead of tripping unique constraints.
  Sign-out calls `DELETE /dev/mock-user`, which removes the identity and
  everything it created; server shutdown sweeps any leftovers. A mock user
  never survives the process that made it.
- **Empty database, open laptop: mock catalogue.** Booting in dev mode with
  no colleges seeds a small catalogue (colleges with application windows, a
  coaching centre, scholarship slabs) so every page has something to show.
  Skipped when dev mode is off, and skipped when colleges exist — real data
  is never touched.
- `DEV_MODE=1` in `backend/.env` (or `NEXT_PUBLIC_DEV_MODE=1` on the frontend)
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
| **Migrations** | Alembic (10 migrations: 001–010) |
| **Rendering** | Next.js 16 App Router — portal pages server-rendered via session cookie |
| **Auth** | Firebase Admin SDK (JWT verification); phone OTP in production, any-4-digits mirror in dev |
| **Payments** | Razorpay (order creation + webhook) |
| **Email** | SMTP transactional mail (decisions, receipts, welcomes, alerts) |
| **Containerisation** | Docker + docker‑compose |
| **Testing** | pytest / httpx (backend, 228 tests) · Vitest (frontend, ~180 tests) |
| **Code quality** | black, ruff, ESLint, `tsc --noEmit` |

---

## ✨ Key Features Delivered

**Public pages redesign**
- Hero sections with campus photography, dark gradient overlays, serif headlines
- Alternating photo/tinted sections across landing, about, why-us, contact
- Login/signup pages with full-bleed campus photos, wider cards, merged dev flow
- Header with emerald monogram logo, translucent sheen sweep, red sign-out

**Contact form → Admin inbox**
- Public form with purpose dropdown (admissions, join college, coaching, payments, problem, press, other)
- Backend `/contact/` endpoint with rate limiting, validation, `/admin/contact-messages` read endpoint
- New migration `005_contact_messages` + `contact_messages` table + admin inbox page
- Acknowledgement email to the sender plus an optional alert to `ADMIN_EMAIL`

**Student dashboard**
- Applied colleges with per-card deadlines, plus a shortlisted section with fees, deadlines and a pay CTA
- No verdicts anywhere student-facing: no status pills, counts, notes or withdraw controls; status-change notifications and emails use neutral "update" wording (old headlines backfilled by migration `009`)
- Submission confirmations: `?paid=1` after checkout, `?welcome=1` after signup

**Referral tracking**
- `GET /students/me` returns `coaching_centre_name` from the invite link; shown as a disabled "Referred by" field on the profile page
- Set once at signup and tamper-proof: `PATCH /students/me` allow-lists name/phone/stream only, and the coaching portal has no write path to student rows at all

**Application windows (migration `006`)**
- Courses carry `application_start_date` and `intake_info` alongside `closing_date`
- Editable in the college portal and the admin portal; shown on landing pages, shortlists, dashboards and the admin detail view

**Coaching bulk uploads (migration `007`)**
- Excel/CSV template download, bulk upload (1,000 rows / 2 MB caps), email dedupe per centre and against registered students
- Every file appends to a cumulative lead database; an optional `shortlisted` column (`College :: Course; …`) resolves into real shortlists when the lead registers
- Outstanding amount on the coaching dashboard: leads × per-lead rate − credit, with terms set in the admin panel

**College landing + admin management (migration `008`)**
- Landing pages show deadlines, intakes, admission phases, the college logo and per-course shortlisting wired to sign-in
- Admin college page manages courses (add / edit deadlines and fees / delete with dependency guard), admission phases and logo upload (`/uploads`, volume-backed in production)
- Authorised-partners logo carousel below the homepage hero (renders once logos are added)

**Email notifications**
- Transactional SMTP mail after each commit, best-effort and never request-breaking: signup welcomes, application decisions, payment receipts, college new-application alerts, staff welcomes, upload summaries, contact acknowledgements
- Empty `SMTP_HOST` disables sending (development logs instead); `PUBLIC_URL` builds the links, `ADMIN_EMAIL` receives platform alerts

**Portal shell overhaul**
- Top header only (no sidebar), emerald pine header with white text, red solid sign-out
- Notification bell with live unread count, markdown-all, deep-link on click
- Notifications written on application status changes and payment capture

**Design system**
- Pure white canvas (`#ffffff`), pine accent `#0b3d2e`, warm sand neutrals removed
- Solid status pills (mint/amber/clay/red), no pale tints
- 12px cards/tables, 8px controls, pill badges only
- Self-hosted Mulish (body) + Poppins (headlines), no Google Fonts at runtime
- Scroll-triggered animations, staggered pop-in, progress rail on step lists
- Reduced-motion safe, GPU-only props

**Backend hardening**
- Notifications table + writer service + router (`/notifications/`)
- Contact messages table + writer + public + admin endpoints
- Stream filter now filters nested course array correctly
- SQL echo off by default (`SQL_ECHO` env var)
- Middleware → proxy migration (Next.js 15 compatible)

**Testing**
- Backend: 196 tests (pytest, httpx, asyncpg, function-scoped isolated schemas)
- Frontend: 107 tests (Vitest, jsdom, RTL)

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
│  │  ├─ routers/       # auth/session, students, colleges, shortlists, payments, portals
│  │  ├─ services/      # Razorpay client, Firebase role claims, email, lead files
│  │  ├─ uploads/       # college logos served at /uploads (gitignored, volume-backed)
│  │  └─ main.py        # FastAPI entry point
│  ├─ migrations/        # Alembic 001–010
│  ├─ seeds/             # colleges, the local admin, demo role accounts
│  ├─ tests/             # pytest suite
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ requirements-dev.txt
│  └─ .env.example
├─ frontend/
│  ├─ app/               # routes; each portal page is a server half + `*Client.tsx`
│  ├─ components/auth/   # PhoneOTPForm (prod) + DevOTPForm (dev mirror)
│  ├─ lib/serverApi.ts   # serverGet (as the user) / publicGet (no credential)
│  ├─ lib/sessionCookie.ts
│  ├─ app/auth/session/  # route handler that sets and clears the cookie
│  ├─ proxy.ts           # edge role gate (Next 16's middleware)
│  └─ __tests__/         # Vitest suite
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
venv\Scripts\python -m pip install -r requirements-dev.txt   # pytest, ruff
venv\Scripts\python -m ruff check .                          # what CI lints with
venv\Scripts\python -m pytest -q
```

The database-backed tests need a `college_platform_test` database and skip
cleanly without one, so a run with Postgres down reports passes and skips
rather than a wall of connection errors:

```bash
docker exec college-platform-db createdb -U dev college_platform_test
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

## 🩺 Troubleshooting

**`/colleges/` returns 500, `column cc.closing_date does not exist`** — the
database predates a migration. Run `alembic upgrade head`. A database created
before migration 003 will serve the portals fine and fail only on the public
catalogue, which makes this easy to misread as a frontend bug.

**Backend cannot reach Postgres** — check which port the container actually
publishes. A container created by an older checkout may be bound to `5432`
while `docker-compose.yml` now uses `5433`:

```bash
docker port college-platform-db
```

Point `DATABASE_URL` at whatever that prints rather than recreating the
container, which would discard its volume.

**Portal pages show "Checking your access" and then load** — that is the
client-side fallback: the session cookie is missing or has lapsed, so the page
is fetching for itself. Signing in again mints a new one. It is degraded
performance, never a loss of access.

---

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
- **Email.** Set `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM` to a real relay,
  `PUBLIC_URL` to the site origin (links inside mails), and `ADMIN_EMAIL`
  for contact-form alerts. The `uploads-data` volume already persists
  college logos across redeploys.
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
# Signs the session tokens the email/password path issues. Nothing to do with
# Firebase - it is what lets people sign in while no service account exists.
# `openssl rand -hex 32`. Staging and production REFUSE TO BOOT without it;
# development falls back to a public constant and warns loudly.
AUTH_SECRET=
# The account `python -m seeds.local_admin` creates. Must be a real domain:
# the login endpoint rejects .test and .localhost.
# Local development defaults (change for your setup):
SEED_ADMIN_EMAIL=admin@edeeapply.in
SEED_ADMIN_PASSWORD=Test@1234
# Days a college/coaching set-password link stays usable.
# INVITE_TTL_DAYS=14
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CORS_ORIGINS=http://localhost:3000
ENVIRONMENT=development
LOG_LEVEL=INFO
# How long a minted session cookie stays valid. Firebase allows 5 minutes to
# 14 days; 8 hours is the default. The frontend's two-hour idle logout is what
# ends an unattended session sooner - this is the hard ceiling behind it.
SESSION_MAX_AGE_SECONDS=28800
# Public site origin, for absolute links inside emails.
PUBLIC_URL=http://localhost:3000
# Outbound email. Empty SMTP_HOST disables sending (development logs).
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USERNAME=
# SMTP_PASSWORD=
# SMTP_FROM=Edee Apply <no-reply@edeeapply.in>
# SMTP_STARTTLS=true
# ADMIN_EMAIL=ops@example.com
```

Email is transactional and best-effort: application decisions, payment
receipts, staff welcomes, upload summaries and contact acknowledgements go
out over SMTP after the request commits, and a failed send never fails the
request (the in-app notification is the durable record). Leave `SMTP_HOST`
empty in development to log instead of sending; set `SMTP_*`, `PUBLIC_URL`
and `ADMIN_EMAIL` in production.

Frontend `.env.local` only contains publishable `NEXT_PUBLIC_*` values. Never put
Razorpay secrets or Firebase service-account credentials there.

## 📚 API overview

Auth and session:

- `POST /auth/session` — exchange a credential for a session cookie. A Firebase
  ID token is verified and swapped for one; a local session token is returned
  as its own. Called by the Next.js route handler, never by the browser.
- `DELETE /auth/session` — revoke every session the account holds
- `GET /auth/me` — the verified claims behind the current credential; this is
  what lets the server open the role gate before hydration

Email and password:

- `POST /auth/signup` — create a student account (name, email, phone,
  password). The only signup on the platform, and students only.
- `POST /auth/login` — email and password for any of the four portals; the
  response carries the role, and the caller decides where to send them
- `POST /auth/password` — change your own password; drops every other session
- `POST /auth/invites` — admin only; issues a college or coaching
  set-password link
- `GET /auth/invites/{token}` — what the set-password page renders
- `POST /auth/invites/{token}/accept` — choose a password; creates the
  credential and the staff row together, once

Every authenticated endpoint accepts either `Authorization: Bearer <credential>`
or `X-Session-Cookie: <credential>`, where the credential is a Firebase ID
token, a Firebase session cookie, or an `edee1.` local session token.

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
- Coaching: `/coaching/dashboard`, `/coaching/students/*`, `/coaching/uploads` (Excel/CSV template, bulk upload, history, cumulative leads), `/coaching/invites`, `/coaching/profile`
- Admin: `/admin/dashboard`, `/admin/colleges/*` (courses add/edit/delete, phases, logo upload), `/admin/coaching-centres`, `/admin/students`, `/admin/users`, `/admin/payments`, `/admin/audit`, `/admin/inbox`, `/admin/system` (live dependency checks for the status page)

Dev only (404 elsewhere):

- `GET /dev/directory` — colleges and centres to sign in as
- `POST /dev/mock-user` — provision mock rows behind a dev token
- `POST /dev/mock-capture` — mock payment: real pricing and fulfillment, no money
- `DELETE /dev/mock-user` — delete the caller's mock rows

Contact & Notifications:

- `POST /contact/` — public contact form (rate limited, validated, stores in `contact_messages`)
- `GET /admin/contact-messages` — admin-only inbox listing
- `GET /notifications/` — list own notifications (8 latest + unread count)
- `PATCH /notifications/{id}/read` — mark one read
- `POST /notifications/read-all` — mark all read

Every response carries `X-Request-ID`; the backend logs one line per request
at INFO (health checks at DEBUG), so a user report maps to a single grep.

Full OpenAPI is served at `/openapi.json`; Swagger UI is at `/docs` outside production.

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch (`git checkout -b feat/awesome`).
3. Run `ruff check` (backend), backend `pytest -q`, frontend `npm run test`, `npm run typecheck`, and `npm run lint`.
4. Open a pull request; CI should run lint and tests.
