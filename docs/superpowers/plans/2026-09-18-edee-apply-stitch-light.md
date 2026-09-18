# Edee Apply Stitch Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Stitch light theme (DESIGN.md tokens, Inter + Newsreader, flat emerald system, sovereign shell) across the whole Next.js frontend.

**Architecture:** Tokens first, then components, then shell and pages, then dependency removal; each task is independently testable and commits cleanly.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (CSS-first tokens), Phosphor icons, vitest + jsdom.

## Global Constraints

- Single emerald accent `#047857`, hover `#065f46`, pressed `#064e3b`, subtle `#ecfdf5`, line `#a7f3d0`; dark fallback accent `#34d399` / `#10b981`; maroon `#D9475C` and gold `#F2BB5D` are deleted.
- Light surfaces `#fbfbfa` / `#ffffff`, text `#18181b` / `#52525b` / muted `#71717a`, borders `#e4e4e7`.
- Status hexes exact: emerald bg `#ecfdf5` / border `#a7f3d0` / text `#047857`; amber bg `#fffbeb` / border `#fde68a` / text `#b45309`; orange bg `#fff7ed` / border `#fed7aa` / text `#c2410c`; red bg `#fef2f2` / border `#fecaca` / text `#b91c1c`.
- Radii: controls `rounded-lg`, cards/tables/modals `rounded-xl`, badges/avatars `rounded-full`; `rounded-2xl` deleted.
- No `bg-gradient-to-*`, no radial washes, no neon animation, no emoji; Phosphor only.
- Money only via `formatFee(paise)`; `tabular` numerals on money.
- Typography: Inter body + Newsreader headlines via `next/font/google`; Geist deleted.
- Commands run from `frontend/` unless stated.

---

### Task 1: Light-locked design tokens

**Files:**
- Modify: `frontend/app/globals.css:29-115`
- Modify: `frontend/app/globals.css:148-206`
- Test: `frontend/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: spec §1 token table.
- Produces: CSS vars `--accent`, `--accent-hover`, `--accent-pressed`, `--accent-subtle`, `--accent-line`, `--success*`, `--action*`, light-locked dark fallback; flat `.btn:hover` / `.card:hover` (no lift).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

describe('design tokens', () => {
  it('locks single emerald accent and deletes maroon/gold', () => {
    expect(css).toContain('--accent: #047857');
    expect(css).toContain('--accent-hover: #065f46');
    expect(css).not.toContain('#D9475C');
    expect(css).not.toContain('#F2BB5D');
    expect(css).not.toContain('--accent-secondary');
  });

  it('defines success + action status tokens in light mode', () => {
    expect(css).toContain('--success: #047857');
    expect(css).toContain('--action: #c2410c');
    expect(css).toContain('--action-subtle: #fff7ed');
  });

  it('has no gradient utilities or vignette', () => {
    expect(css).not.toMatch(/linear-gradient\(\s*90deg,\s*var\(--surface/);
    expect(css).not.toContain('.vignette');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/tokens.test.ts`
Expected: FAIL (missing `--accent-pressed`/`--success`/`--action`, maroon present, `.vignette` present).

- [ ] **Step 3: Write minimal implementation**

Replace `:root` accent/status block and the dark block in `frontend/app/globals.css`:

```css
:root {
  color-scheme: light;
  --surface: #fbfbfa;
  --surface-raised: #ffffff;
  --surface-sunken: #f4f4f5;
  --surface-hover: #f0f0ee;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --text-muted: #71717a;
  --text-inverse: #fafafa;
  --line: #e4e4e7;
  --line-strong: #d4d4d8;
  --accent: #047857;
  --accent-hover: #065f46;
  --accent-pressed: #064e3b;
  --accent-subtle: #ecfdf5;
  --accent-line: #a7f3d0;
  --accent-text: #065f46;
  --success: #047857;
  --success-subtle: #ecfdf5;
  --success-line: #a7f3d0;
  --action: #c2410c;
  --action-subtle: #fff7ed;
  --action-line: #fed7aa;
  --danger: #b91c1c;
  --danger-subtle: #fef2f2;
  --danger-line: #fecaca;
  --warning: #b45309;
  --warning-subtle: #fffbeb;
  --warning-line: #fde68a;
  --focus-ring: #047857;
  --shadow-sm: 0 1px 2px rgb(24 24 27 / 0.06);
  --shadow-md: 0 4px 16px -4px rgb(24 24 27 / 0.1);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: light;
    --surface: #fbfbfa;
    --surface-raised: #ffffff;
    --surface-sunken: #f4f4f5;
    --surface-hover: #f0f0ee;
    --text-primary: #18181b;
    --text-secondary: #52525b;
    --text-muted: #71717a;
    --text-inverse: #fafafa;
    --line: #e4e4e7;
    --line-strong: #d4d4d8;
    --accent: #047857;
    --accent-hover: #34d399;
    --accent-pressed: #10b981;
    --accent-subtle: #ecfdf5;
    --accent-line: #a7f3d0;
    --accent-text: #065f46;
    --focus-ring: #047857;
  }
}
```

Flatten interactive lifts (keep transitions, drop transforms):

```css
.btn:hover {
  box-shadow: var(--shadow-md);
}
.btn:active {
  transform: scale(0.98);
}
.card:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--line-strong);
}
```

Delete the `.vignette` and `.hero-content` blocks entirely.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/__tests__/tokens.test.ts
git commit -m "feat: lock Stitch light emerald tokens, flat elevation"
```

---

### Task 2: Inter + Newsreader fonts

**Files:**
- Modify: `frontend/app/layout.tsx:1-16`
- Modify: `frontend/app/globals.css:16-18`
- Test: `frontend/__tests__/typography.test.ts`

**Interfaces:**
- Consumes: Task 1 tokens; spec §1 typography.
- Produces: exported font variables consumed by `globals.css` (`--font-sans`, `--font-serif`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8');

describe('typography', () => {
  it('uses Inter + Newsreader and removes Geist', () => {
    expect(layout).toContain('Inter');
    expect(layout).toContain('Newsreader');
    expect(layout).not.toContain('Geist');
    expect(layout).not.toContain('Geist_Mono');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/typography.test.ts`
Expected: FAIL (Geist present, Inter/Newsreader absent).

- [ ] **Step 3: Write minimal implementation**

Replace lines 1-16 of `frontend/app/layout.tsx` (drop `Geist` and `Geist_Mono` entirely; mono falls back to the system stack):

```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const newsreader = Newsreader({
  variable: '--font-news',
  subsets: ['latin'],
  display: 'swap',
});
```

Update body class to `${inter.variable} ${newsreader.variable}`.

Update the `@theme` block in `frontend/app/globals.css` (lines 16-18):

```css
@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-news), Georgia, serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/typography.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css frontend/__tests__/typography.test.ts
git commit -m "feat: adopt Inter body and Newsreader headlines"
```

---

### Task 3: Badge action tone, delete info-blue

**Files:**
- Modify: `frontend/components/ui/Badge.tsx:1-12`
- Modify: `frontend/lib/format.ts:58-67`
- Test: `frontend/__tests__/components/Badge.test.tsx`

**Interfaces:**
- Consumes: Task 1 vars (`--action*`, `--success*`).
- Produces: `Tone` = `'neutral' | 'success' | 'warning' | 'action' | 'danger'`; `APPLICATION_STATUS_TONE.payment_received === 'success'`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '@/components/ui/Badge';
import { APPLICATION_STATUS_TONE } from '@/lib/format';

describe('Badge', () => {
  it('renders the orange action-required tone as a pill', () => {
    render(<Badge tone="action">Payment pending</Badge>);
    const el = screen.getByText('Payment pending');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('var(--action-subtle)');
  });

  it('maps payment_received to emerald, not info-blue', () => {
    expect(APPLICATION_STATUS_TONE.payment_received).toBe('success');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/Badge.test.tsx`
Expected: FAIL (`tone="action"` type error; `payment_received` is `'info'`).

- [ ] **Step 3: Write minimal implementation**

`frontend/components/ui/Badge.tsx`:

```tsx
export type Tone = 'neutral' | 'success' | 'warning' | 'action' | 'danger';

const TONES: Record<Tone, string> = {
  neutral:
    'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--line-strong)]',
  success:
    'bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success-line)]',
  warning:
    'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning-line)]',
  action:
    'bg-[var(--action-subtle)] text-[var(--action)] border-[var(--action-line)]',
  danger: 'bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger-line)]',
};
```

`frontend/lib/format.ts`: change `APPLICATION_STATUS_TONE` to

```ts
export const APPLICATION_STATUS_TONE: Record<
  ApplicationStatus,
  'neutral' | 'success' | 'danger' | 'warning' | 'action'
> = {
  payment_received: 'success',
  under_review: 'warning',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};
```

Update every `tone="info"` call site to `tone="success"` (search `tone="info"`; render path only, no logic change).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/Badge.test.tsx __tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/Badge.tsx frontend/lib/format.ts frontend/__tests__/components/Badge.test.tsx
git commit -m "feat: add orange action badge, remove info-blue"
```

---

### Task 4: Table radius, contact emoji and success fix

**Files:**
- Modify: `frontend/components/ui/Input.tsx:10-11`
- Modify: `frontend/components/ui/Table.tsx:7-13`
- Modify: `frontend/app/(public)/contact/page.tsx:70-72`
- Modify: `frontend/app/(public)/contact/page.tsx:112-114`
- Test: `frontend/__tests__/components/TableContact.test.tsx`

**Interfaces:**
- Consumes: Tasks 1-3 tokens/tones.
- Produces: `TableWrap` with `rounded-xl`; contact page with zero emoji and working success token; `Input`/`Select`/`Textarea` emerald focus ring.

**Interfaces:**
- Consumes: Tasks 1-3 tokens/tones.
- Produces: `TableWrap` with `rounded-xl`; contact page with zero emoji and working success token.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { TableWrap } from '@/components/ui/Table';

const contact = readFileSync(
  resolve(__dirname, '../../app/(public)/contact/page.tsx'),
  'utf8',
);
const input = readFileSync(
  resolve(__dirname, '../../components/ui/Input.tsx'),
  'utf8',
);

describe('table + contact', () => {
  it('wraps tables in 12px cards', () => {
    const { container } = render(
      <TableWrap>
        <table>
          <tbody>
            <tr>
              <td>x</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>,
    );
    expect(container.firstElementChild?.className).toContain('rounded-xl');
  });

  it('has no emoji fallback', () => {
    expect(contact).not.toContain('<span>✉</span>');
    expect(contact).toContain('EnvelopeSimple');
  });

  it('rings inputs in emerald on focus', () => {
    expect(input).toContain('focus:border-[var(--accent)]');
    expect(input).toContain('focus:ring-[var(--accent)]/20');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/TableContact.test.tsx`
Expected: FAIL (`rounded-lg` in TableWrap; `✉` present; `EnvelopeSimple` absent).

- [ ] **Step 3: Write minimal implementation**

`Table.tsx` line 9: `overflow-hidden rounded-lg` → `overflow-hidden rounded-xl`.

`Input.tsx` line 11 `BASE`: append ` focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20` (keeps 8px, adds DESIGN.md §6 focus treatment; `Select`/`Textarea` inherit via `BASE`).

`contact/page.tsx`: add `EnvelopeSimple` to the Phosphor import; replace

```tsx
{c.icon ? <c.icon size={20} aria-hidden="true" /> : <span>✉</span>}
```

with

```tsx
{c.icon ? (
  <c.icon size={20} aria-hidden="true" />
) : (
  <EnvelopeSimple size={20} aria-hidden="true" />
)}
```

Keep the `var(--success)` success panel as-is (Task 1 defines the token). Change `rounded-xl` on that panel only if it is a card — it is a card, keep `rounded-xl`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/TableContact.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/Input.tsx frontend/components/ui/Table.tsx "frontend/app/(public)/contact/page.tsx" frontend/__tests__/components/TableContact.test.tsx
git commit -m "fix: 12px tables, emerald input focus, Phosphor envelope"
```

---

### Task 5: Radii and gradient sweep

**Files:**
- Modify: `frontend/components/college/CollegeLandingPage.tsx:31-42,57,68-80,144`
- Modify: `frontend/components/student/CheckoutSummary.tsx:17`
- Modify: `frontend/app/(public)/about/page.tsx:53,79-80,104,125,155`
- Modify: `frontend/app/(public)/why-us/page.tsx:45,74,101-102,129,147`
- Modify: `frontend/app/(public)/contact/page.tsx:41,70-71,195-197`
- Test: `frontend/__tests__/sweep.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: zero `rounded-2xl`, zero `bg-gradient-to-`, zero `radial-gradient` in the touched files.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'components/college/CollegeLandingPage.tsx',
  'components/student/CheckoutSummary.tsx',
  'app/(public)/about/page.tsx',
  'app/(public)/why-us/page.tsx',
  'app/(public)/contact/page.tsx',
];

describe('radii + gradient sweep', () => {
  it('uses 12px cards and flat surfaces only', () => {
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect(`${f}: ${src}`).not.toContain('rounded-2xl');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-');
      expect(`${f}: ${src}`).not.toContain('radial-gradient');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sweep.test.ts`
Expected: FAIL (lists each offending file).

- [ ] **Step 3: Write minimal implementation**

Per file, mechanical replacements only:
- `rounded-2xl` → `rounded-xl` (cards, hero panels, CTA bands, image frames).
- `CheckoutSummary.tsx` section `rounded-lg` → `rounded-xl` (it is a summary table card).
- Icon tiles `rounded-xl` (e.g. `h-11 w-11 ... rounded-xl`, `h-14 w-14 ... rounded-2xl`) → `rounded-lg`.
- `bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5` hero wash → delete the `div`.
- `bg-gradient-to-t from-[var(--surface)] to-transparent` fade → delete the `div`.
- `bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_70%)]` glows → delete the `div`.
- Timeline dots / step numerals `rounded-full` stay unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sweep.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/college/CollegeLandingPage.tsx frontend/components/student/CheckoutSummary.tsx "frontend/app/(public)/about/page.tsx" "frontend/app/(public)/why-us/page.tsx" "frontend/app/(public)/contact/page.tsx" frontend/__tests__/sweep.test.ts
git commit -m "fix: 12px cards, flat surfaces, no gradient washes"
```

---

### Task 6: Sovereign portal shell

**Files:**
- Modify: `frontend/components/shells/PortalShell.tsx`
- Test: `frontend/__tests__/components/Shell.test.tsx`

**Interfaces:**
- Consumes: Tasks 1-3; `PORTAL_NAV` from `components/shells/nav.ts`; `Role`, `PORTAL_LABEL` from `lib/portals.ts`.
- Produces: unchanged props `{ role: Role; children: React.ReactNode }`; DOM contains `w-64` sidebar, `h-16` header, search with `⌘K`, `aria-label="Notifications"`, `max-w-7xl` content.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shell = readFileSync(
  resolve(__dirname, '../../components/shells/PortalShell.tsx'),
  'utf8',
);

describe('sovereign shell', () => {
  it('docks a w-64 sidebar with h-16 header and max-w-7xl content', () => {
    expect(shell).toContain('w-64');
    expect(shell).toContain('h-16');
    expect(shell).toContain('max-w-7xl');
    expect(shell).toContain('⌘K');
    expect(shell).toContain('aria-label="Notifications"');
    expect(shell).toContain('bg-emerald-50');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/Shell.test.tsx`
Expected: FAIL (`15rem` grid, no `h-16`/`⌘K`/`Notifications`/`max-w-7xl`).

- [ ] **Step 3: Write minimal implementation**

Rewrite `PortalShell.tsx` shell chrome (keep `role`/`children` props, `PORTAL_NAV[role]`, `useAuth` sign-out, mobile drawer state):

```tsx
<div className="min-h-[100dvh] bg-[var(--surface)] md:grid md:grid-cols-[16rem_1fr]">
  {/* mobile bar */}
  <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 md:hidden">
    {/* unchanged toggle */}
  </header>

  <nav id="portal-nav" /* w-64 sidebar, active bg-emerald-50 text-emerald-700 */ />

  <div className="min-w-0">
    <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-raised)] px-6 md:flex">
      <form
        onSubmit={submitSearch}
        role="search"
        className="flex h-10 w-72 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)]"
      >
        <MagnifyingGlass size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search"
          className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <kbd className="rounded border border-[var(--line)] px-1.5 text-xs">⌘K</kbd>
      </form>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-text)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          Synced
        </span>
        <button type="button" aria-label="Notifications" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)]">
          <Bell size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
    <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
  </div>
</div>
```

Sidebar: `md:sticky md:top-0 md:h-[100dvh] md:w-64 md:border-r`; links keep `rounded-lg px-3 py-2 text-sm`, active `bg-emerald-50 text-emerald-700 font-semibold` (literal `bg-emerald-50` class required by test; emerald-50 `#ecfdf5` matches token). Header search submits to the current list query (no new endpoint):

```tsx
const [query, setQuery] = useState('');

function submitSearch(event: React.FormEvent) {
  event.preventDefault();
  const next = query.trim();
  router.push(next ? `${pathname}?search=${encodeURIComponent(next)}` : pathname);
}

// in the h-16 header:
<form
  onSubmit={submitSearch}
  role="search"
  className="flex h-10 w-72 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)]"
>
  <MagnifyingGlass size={16} aria-hidden="true" />
  <input
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Search"
    aria-label="Search"
    className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
  />
  <kbd className="rounded border border-[var(--line)] px-1.5 text-xs">⌘K</kbd>
</form>
```

Bell renders a static button (counts derived from loaded lists where available). Imports: `Bell`, `MagnifyingGlass` from `@phosphor-icons/react`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/Shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/shells/PortalShell.tsx frontend/__tests__/components/Shell.test.tsx
git commit -m "feat: sovereign shell with w-64 sidebar and h-16 header"
```

---

### Task 7: Static hero, delete 3D gradient deps

**Files:**
- Create: `frontend/public/campuses/graduation.jpg`
- Create: `frontend/public/campuses/fergusson.jpg`
- Create: `frontend/public/campuses/xaviers.jpg`
- Create: `frontend/public/campuses/loyola.jpg`
- Create: `frontend/public/campuses/christ.jpg`
- Modify: `frontend/app/(public)/page.tsx:17,74-77`
- Delete: `frontend/components/ui/HeroGradient.tsx`
- Modify: `frontend/package.json:14-25,27-42`
- Test: `frontend/__tests__/hero.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 5 (flat surfaces); repo-root `stitch-assets/` downloads.
- Produces: zero `HeroGradient` imports; zero `shadergradient`/`three` deps; hero `<img src="/campuses/graduation.jpg">` with flat overlay.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('static hero', () => {
  it('ships local campus photos and drops the 3D deps', () => {
    expect(existsSync(resolve(__dirname, '../public/campuses/graduation.jpg'))).toBe(true);
    const page = readFileSync(
      resolve(__dirname, '../app/(public)/page.tsx'),
      'utf8',
    );
    expect(page).not.toContain('HeroGradient');
    expect(page).toContain('/campuses/graduation.jpg');
    const pkg = readFileSync(resolve(__dirname, '../package.json'), 'utf8');
    expect(pkg).not.toContain('shadergradient');
    expect(pkg).not.toContain('"three"');
    expect(pkg).not.toContain('react-three');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/hero.test.ts`
Expected: FAIL (no `public/campuses/`; `HeroGradient` imported; deps present).

- [ ] **Step 3: Write minimal implementation**

Copy (repo root → public; source files hold JPEG data despite `.png` names):

```bash
mkdir -p frontend/public/campuses
cp stitch-assets/28b4334051cb4b66b62c7a7159f00c07-screenshot.png frontend/public/campuses/graduation.jpg
cp stitch-assets/3df7fc40ce1647ada0b86acd6ee6c400-screenshot.png frontend/public/campuses/fergusson.jpg
cp stitch-assets/3aedde2cacf24957be65e18abe66a770-screenshot.png frontend/public/campuses/xaviers.jpg
cp stitch-assets/edf6aa592bf14dc1af53965c3d5a71e7-screenshot.png frontend/public/campuses/loyola.jpg
cp stitch-assets/77cad8bbfe2941ca9db408a82d599b5d-screenshot.png frontend/public/campuses/christ.jpg
```

`page.tsx`: delete `import HeroGradient`, replace

```tsx
<HeroGradient />
<div className="vignette" aria-hidden="true" />
```

with

```tsx
<img
  src="/campuses/graduation.jpg"
  alt="Graduates celebrating on a historic Indian university quadrangle"
  className="absolute inset-0 h-full w-full object-cover"
/>
<div className="absolute inset-0 bg-black/50" aria-hidden="true" />
```

Delete `frontend/components/ui/HeroGradient.tsx`. `package.json`: remove `@react-three/fiber`, `@shadergradient/react`, `camera-controls`, `three`, `three-stdlib`, `@types/three`; run `npm install`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/hero.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(public)/page.tsx" frontend/components/ui/HeroGradient.tsx frontend/package.json frontend/package-lock.json frontend/public/campuses frontend/__tests__/hero.test.ts
git commit -m "feat: static campus hero, remove 3D gradient stack"
```

---

### Task 8: Full verification

**Files:**
- Test: all `frontend/__tests__/**/*.test.{ts,tsx}`

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: green typecheck, lint, tests, build.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS with no errors.

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`
Expected: PASS including `format.test.ts` (paise), `Badge.test.tsx` (action tone), `sweep.test.ts` (no rounded-2xl/gradients), `hero.test.ts` (static photos).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Manual pass (no commit)**

Visit student, college, coaching, admin lists; confirm loading → content, empty, and error-with-retry states; pay flow totals via `formatFee`; `tabular` numerals; focus ring visible; `prefers-color-scheme: dark` still renders emerald light theme; no gradients, neon, emoji, maroon, or Geist remnants (`rg "Geist|D9475C|F2BB5D|rounded-2xl|bg-gradient|radial-gradient|✉|HeroGradient|shadergradient"` returns only spec/plan docs).

- [ ] **Step 6: Commit test files only if changed**

```bash
git status --short
git commit -m "test: verify Stitch light theme" -- frontend/__tests__ || echo "nothing to commit"
```
