# Security review — 9 September 2026

Audit of the backend carried out while wiring the Next.js frontend to it.
Everything below was found in the committed code and has been fixed in place.
Severity is about consequence, not exploit difficulty.

---

## Critical

### 1. Paying for one application created applications for all of them

`app/routers/payments.py`, webhook handler.

```sql
-- before
SELECT s.id, s.college_id, s.course_id
FROM shortlists s
JOIN orders o ON o.student_id = s.student_id   -- joined on the student, not the order
WHERE o.id = :order_id
```

The join matched every shortlist row belonging to the paying student, so a
student who shortlisted twenty courses and paid for one received twenty
applications. Colleges would see, and act on, applications nobody paid for.

The root cause was structural: `orders` recorded a total but never recorded
*what the total was for*, so the webhook had nothing to work from and guessed.

**Fixed** by adding an `order_items` table (migration `002`) written at
`create-order` time, recording the shortlist entry, college, course, and the
fee as quoted at purchase. The webhook now reads only that, and refuses to
proceed at all if an order has no items rather than falling back to a guess.

### 2. Nothing was authorised, only authenticated

`require_role` and `require_any_role` existed in `app/middleware/auth.py` and
were **never imported anywhere**. Every endpoint used `get_current_user`, which
answers "is this a valid Firebase token" and nothing else. Any authenticated
account on the project could call any endpoint.

Compounding it, `POST /students/` never set a role claim, so the role model had
no values in it to check even if something had checked.

**Fixed**: `require_roles(*roles)` plus `current_college_id` /
`current_coaching_centre_id` scoping dependencies; every route now carries a
guard (verified by test, see below). `POST /students/` assigns the `student`
claim in the same transaction that creates the row.

---

## High

### 3. Revoked tokens kept working

`verify_id_token(token)` was called without `check_revoked=True`. Disabling an
account or calling `revoke_refresh_tokens` had no effect until the ID token
expired naturally — up to an hour of continued access for a compromised or
dismissed account.

**Fixed**: `check_revoked=True`, and `revoke_access()` now clears the claim and
revokes refresh tokens together.

### 4. Signup accepted someone else's identity

`create_student` took `email` and `phone` straight from the request body while
a verified `email` / `phone_number` sat unused in the token. A user could
register under any address, which then received that person's application mail.

**Fixed**: identity is taken from the verified token wherever the token carries
it; the body is a fallback only. A staff account can no longer create a student
profile on top of itself.

### 5. Missing college returned a 500 with a stack trace

`app/routers/colleges.py` raised `HTTPException` without importing it, so
`GET /colleges/{id}` for an unknown id raised `NameError` and returned a 500.
With FastAPI debug on that response carries a traceback.

**Fixed**: import added, `college_id` typed as `UUID` so malformed ids are a
422 from the framework, and a catch-all handler now logs the detail and returns
a generic 500 body.

### 6. The webhook trusted the amount in its payload

The captured amount was written to `payments` without ever being compared to
`orders.amount`.

**Fixed**: a mismatch is logged and rejected before any application is created.

### 7. Backend could not start on Python 3.12

`razorpay==1.4.1` imports `pkg_resources` at module scope. setuptools 81
deprecated it and 84 removed it, so `import app.main` failed outright on a
current toolchain.

**Fixed**: `razorpay==2.0.1` and an explicit `setuptools<81` pin, with a comment
recording why the pin cannot simply be raised. (razorpay 2.0.1 still imports
`pkg_resources`; the pin goes away when the SDK does.)

---

## Medium

| | Issue | Fix |
|---|---|---|
| 8 | CORS origin hardcoded to `localhost:3000`, `allow_methods=["*"]`, `allow_headers=["*"]`, with `allow_credentials=True` | `CORS_ORIGINS` env var, explicit method and header lists. A wildcard origin with credentials is refused by test. |
| 9 | `/docs`, `/redoc`, `/openapi.json` served unconditionally | Disabled when `ENVIRONMENT` is production |
| 10 | `echo=ENVIRONMENT == "development"` logged every statement with parameters — names, emails, phone numbers | Gated behind a non-production check with the reason written down |
| 11 | `except Exception: pass` around application creation swallowed real failures | Removed; failures now abort the transaction |
| 12 | No ownership check pairing `course_id` with `college_id` when shortlisting | Pair is verified against `college_courses` before insert |
| 13 | `create-order` silently charged for the subset of items it could find | Refuses the whole order with a 409 and tells the student to refresh |
| 14 | Unbounded `stream` / `state` / `search` query params | `Literal` types, length caps, and `%` / `_` escaped in `ILIKE` patterns |
| 15 | Unbounded list sizes and text fields on every request model | Explicit `Field` bounds throughout |
| 16 | `applications.status` was free text | CHECK constraint plus a server-side transition table |
| 17 | `get_db` returned dirty connections to the pool after an error | Rolls back on exception |
| 18 | Missing token returned 403 | 401 with `WWW-Authenticate: Bearer`, so clients can tell "sign in" from "not allowed" |
| 19 | Firebase initialised at import, so nothing could be imported without a production credential | Lazy `_firebase_app()` |
| 20 | Postgres published on `0.0.0.0` by compose | Bound to `127.0.0.1` |

Also added, as defence rather than a fix: `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store` on every
response, HSTS in production, and `CHECK` constraints refusing non-positive
fees and order amounts.

---

## Deliberately not changed

- **Rate limiting.** There is none, on any endpoint. It belongs at the ingress
  or in a dedicated dependency, and guessing at limits here would be worse than
  the honest gap. Worth doing before launch, particularly on OTP.
- **`college_admins` / `coaching_center_admins` as separate tables.** The dev
  guide describes a single `platform_users` table. Merging them is a data
  migration with no security benefit, so `002` adds `platform_users` for the
  admin role only and leaves the existing two alone.

---

## Verification

```
backend:   88 passed   (pytest tests/test_security.py)
frontend:  54 passed   (vitest)           typecheck clean, lint clean
```

`tests/test_security.py` runs without a database. It substitutes a session that
raises if it is ever reached, so an allowed role proves the guard passed by
getting as far as the database, and a denied role must get a 403 before it. The
matrix covers all four roles against seventeen endpoints, plus:

- a token with no role claim, and one inventing a fifth role
- a `college` claim with no `college_id`, and one with a malformed id
- webhook signature: missing, wrong, correct, and re-serialised body
- payment signature: verifies that the webhook secret cannot sign a browser
  confirmation, and that a signature does not transfer to another order id
- the transition table: no path from any state to `withdrawn`

**Not verified:** anything requiring a live database. Docker Desktop's engine
was not running on this machine, so migration `002` has not been applied to a
real Postgres and no end-to-end payment run was performed. The SQL is
unexercised. Run `alembic upgrade head` and the flow in `README.md` before
trusting it.
