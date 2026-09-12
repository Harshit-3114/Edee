# College Platform - Frontend

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Firebase Auth · Razorpay

Four portals in one app: **student**, **college**, **coaching**, **admin**.

## Running it

```bash
copy .env.local.example .env.local   # fill in the Firebase values
npm ci
npm run dev                          # http://localhost:3000
```

The app runs before Firebase is configured - every screen renders, sign-in is
the only thing that will not work. That is deliberate, so the UI can be built
against the backend before the Firebase project exists.

With Docker, from the repository root:

```bash
docker compose up -d db frontend
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run test` | Vitest, 57 tests |
| `npm run lint` | ESLint, including the portal-isolation rule |
| `npm run typecheck` | `tsc --noEmit` |

## How the portals fit together

`lib/portals.ts` is the single source of truth for which role owns which URL
prefix. Every redirect reads it; nothing else hardcodes a portal path. Adding a
fifth portal means editing that file, adding a layout, and nothing else.

Three layers guard a portal, and only the last one is security:

1. **`middleware.ts`** reads a `portal_role` cookie at the edge and redirects
   before the wrong bundle is fetched. The cookie is client-written and
   forgeable - it is a routing hint, not proof.
2. **`RoleGate`** (in each portal's layout) re-checks the role against the
   *verified* Firebase token, which closes the forged-cookie gap in the UI.
3. **The API** verifies the JWT and the row-level scope on every request. This
   is the boundary that matters. A forged cookie gets a rendered shell and a
   wall of 403s.

Portal layouts are Server Components declaring `dynamic = 'force-dynamic'`.
Nothing behind a login is worth prerendering, and it keeps the build from
needing Firebase credentials.

## Conventions

- **One accent colour** (emerald) across all four portals. Portal identity comes
  from the nav and the content, never from a different palette.
- **One radius scale**: `rounded-lg` for buttons, inputs, cards and tables;
  full pill for badges only.
- **Money is paise on the wire.** Everything a user sees goes through
  `formatFee()` in `lib/format.ts`. Nothing divides by 100 inline.
- **Portal components stay in their portal.** `components/<portal>/` is imported
  only by `app/<portal>/`; anything two portals need moves to `components/ui/`.
  Enforced by `no-restricted-imports` in `eslint.config.mjs`.
- **Buttons vs links**: `Button` for actions, `LinkButton` for navigation. An
  anchor nested in a button is invalid HTML and breaks keyboard navigation.
- **Every list has four states**: loading skeleton, empty, error with retry, and
  content.

## Backend endpoints this expects

Student `/students/*`, `/colleges/`, `/shortlists/*`, `/payments/*` ·
College `/college/*` · Coaching `/coaching/*` · Admin `/admin/*`

Portal endpoints take no `college_id` or `coaching_centre_id` parameter. The
backend reads the scope from the verified token, which is what stops one
college from querying another's applicants.

See `../college-platform-dev-guide.md` §2 and §11 for the full contract.
