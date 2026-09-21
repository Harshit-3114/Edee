# Local password authentication

**Date:** 2026-09-20
**Status:** approved, ready for implementation

## Why

The Firebase API key has not arrived. Every identity path in the platform
currently runs through Firebase: `middleware/auth.py` verifies Firebase ID
tokens and session cookies, and each identity table keys off a `firebase_uid`
column. Without a key, nobody can sign in at all except through the `dev:`
token bypass, which is explicitly local-only.

This adds a second, self-contained identity path: email and password, with the
hash stored in our own database. It sits **alongside** Firebase rather than
replacing it. Nothing Firebase-related is removed, so switching back — or
running both — is a configuration question, not a rewrite.

The Firebase-less path is a first-class path, not a degraded fallback. It must
work completely on its own.

## Constraints

1. Do not remove or weaken any existing Firebase code path.
2. The password hash lives in our database.
3. Only the student portal offers signup. College and coaching accounts are
   provisioned by an admin through single-use invite links. The admin account
   is seeded.
4. Password sign-in sits alongside phone OTP and Google sign-in, not instead
   of them.

## Design

### Identity shape

Local accounts get a uid of the form `local:<uuid>`, written into the existing
`firebase_uid` columns on `students`, `college_admins`,
`coaching_center_admins` and `platform_users`.

This is the load-bearing decision. Because the uid is just text and the local
login path produces the same claims dict shape Firebase produces
(`uid`, `role`, `college_id`, `coaching_centre_id`), every downstream guard —
`require_roles`, `current_college_id`, `current_coaching_centre_id`, every
ownership `WHERE` clause, `RoleGate`, `proxy.ts` — keeps working untouched.

The column keeps its `firebase_uid` name. Renaming it would touch every query
in the codebase for no behavioural gain, and the name becomes accurate again
the moment Firebase is switched on.

### Tables (migration 010)

**`auth_credentials`**

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `uid` | text unique, `local:<uuid>` — the value written into `firebase_uid` columns |
| `email` | text unique, stored lowercased |
| `password_hash` | text, bcrypt |
| `role` | text, checked against student/college/coaching/admin |
| `college_id` | uuid fk, required when role is college |
| `coaching_centre_id` | uuid fk, required when role is coaching |
| `active` | boolean, default true |
| `token_version` | integer, default 0 |
| `created_at`, `password_changed_at` | timestamptz |

`token_version` is the revocation lever. It is embedded in every issued token;
bumping it invalidates every outstanding session for that account
immediately. This is the local equivalent of the `check_revoked=True`
guarantee the Firebase path relies on, and preserving that guarantee matters —
without it, deactivating a compromised staff account would do nothing until
the token expired on its own.

**`auth_invites`**

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `token_hash` | text unique, sha256 of the raw token |
| `email`, `name` | text |
| `role` | text, checked against college/coaching only |
| `college_id`, `coaching_centre_id` | uuid fks |
| `expires_at`, `used_at` | timestamptz |
| `created_by` | uuid |
| `created_at` | timestamptz |

Only the hash is stored. The raw token exists once, inside the link handed to
the admin. A database leak therefore does not hand out staff accounts.

### Password hashing — `app/services/passwords.py`

bcrypt at cost 12, via the `bcrypt` package directly. Not passlib: it is
unmaintained and its bcrypt backend is broken against bcrypt 4.x.

Exposes `hash_password`, `verify_password`, and `needs_rehash` so the cost
factor can be raised later without invalidating existing hashes.

### Session token — `app/core/local_token.py`

Firebase cannot mint a session cookie without a key, so the local path mints
its own: `edee1.<base64url payload>.<hmac-sha256>`.

Payload carries `uid`, `role`, `college_id`, `coaching_centre_id`, `tv`
(token_version), `iat`, `exp`.

Stdlib `hmac`/`base64`/`json` rather than PyJWT: one fewer dependency for a
token we both mint and verify, and no `alg` header means the algorithm
confusion class of bug cannot exist here.

Signed with a new `AUTH_SECRET` setting. Staging and production refuse to boot
without it, matching how the lifespan check in `app/main.py` already fails
closed on a missing service account. Development falls back to a fixed
constant with a loud warning, so local sessions survive a restart.

### Middleware — `app/middleware/auth.py`

`get_current_user` and `_verify_session_cookie` each gain one branch, tried
first because it is the cheapest: a credential starting with `edee1.` is
verified by signature and expiry, then by a single `SELECT` on
`auth_credentials` confirming `active` and a matching `token_version`.

The existing `dev:` and Firebase branches follow, unchanged.

`get_current_user` needs a database session it does not currently have. This
is the only invasive change; call sites are unaffected because it is a
`Depends`. The added `SELECT` is strictly cheaper than the Firebase path,
which makes a network call per request.

### Endpoints — `app/routers/auth.py`

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /auth/signup` | public | Student only, hard-coded. Creates `auth_credentials` + `students` in one transaction. Rate-limited. |
| `POST /auth/login` | public | `{email, password, portal}`. Rate-limited per IP and email. |
| `POST /auth/invites` | admin | Returns the one-time link. |
| `GET /auth/invites/{token}` | public | Returns email, role and org name, or 404. |
| `POST /auth/invites/{token}/accept` | public | Sets the password, creates the credential and the staff row. Single-use. |
| `POST /auth/password` | any | Change own password; bumps `token_version`. |

`POST /auth/session` gains a local-token branch returning the token as its own
session — the same thing the dev branch already does. Because of this,
`frontend/app/auth/session/route.ts` and the whole SSR cookie path need no
changes at all.

`DELETE /auth/session` bumps `token_version` for local accounts, matching the
"sign out everywhere" behaviour the Firebase path gives.

**Failure messages.** Every login failure returns the same
"Email or password is incorrect", whether the account is missing, the password
is wrong, or the account is deactivated. Distinguishing them is a user
enumeration oracle. A role/portal mismatch is the one exception: that is
reported precisely, because the account holder has already proved who they
are, and the UI already renders a "wrong portal" recovery path.

### Frontend

- `components/auth/PasswordForm.tsx` — shared by all four portals.
- `?portal=student` shows the password form **alongside** `PhoneOTPForm` and
  `GoogleSignIn`. Staff portals show the password form only.
- `/signup` becomes dual-mode: with no Firebase user it is a real signup
  (name, email, phone, password, confirm, stream, invite code); with a Firebase
  user it keeps today's profile-completion behaviour exactly. One validation
  path serves both.
- `/set-password?token=…` — new page for invite acceptance.
- `lib/localSession.ts` mirrors `lib/devSession.ts`: token in localStorage plus
  the role cookie `proxy.ts` reads. `useRole`, `useAuth` and
  `startServerSession` gain it as an identity source, the same way they already
  fall back to dev tokens.
- Signup is offered only under `portal=student`. Staff portals keep their
  existing "accounts are created by the platform team" copy.

### Seeds

`seeds/users.py` keeps its Firebase path and gains a local one that seeds
**only the admin**. College and coaching accounts are created by that admin
through invite links. Password comes from `SEED_ADMIN_PASSWORD`, defaulting to
the existing `Test@1234`, and the script still refuses to run in production.

## Testing

- Hash round-trip; wrong password rejected; `needs_rehash` on a cost change.
- Token sign/verify; tampered payload rejected; expired token rejected;
  stale `token_version` rejected.
- Middleware accepts a local token, rejects a forged one, and still accepts
  both `dev:` and Firebase credentials.
- Signup creates both rows atomically; duplicate email and duplicate phone are
  both refused; a failure leaves neither row behind.
- Login against the wrong portal reports a mismatch rather than a success.
- Invite is single-use and expires; an accepted invite cannot be replayed.
- A student token is refused by a college endpoint (the cross-role guard still
  holds for local identities).

## Out of scope

- Password reset by email. Admins can reissue an invite; students will need it
  eventually, but it needs the SMTP path proven first.
- Migrating existing Firebase accounts to local credentials. When the key
  arrives the two paths coexist; no migration is implied.
