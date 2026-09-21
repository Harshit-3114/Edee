# Edee Apply — Stitch Light Theme, Whole Site

Date: 2026-09-18
Sources: user prompt rules + DESIGN.md (provided 2026-09-18) + Stitch project `13185821773420105255` (system LIGHT, emerald `#047857`, ROUND_EIGHT) + downloaded reference `stitch-assets/5860625be57f439f8151a5da87e94589-code.html` + 5 campus photos.
Decisions locked: full DESIGN.md typography (Inter body + Newsreader headlines, no Geist) · DESIGN.md radii (8px controls / 12px cards-tables-modals / pill badges) · full shell upgrade (w-64 + h-16 header) · Stitch light theme applied site-wide (light-locked, single emerald, flat, no gradients/neon/emoji).

Stitch HTML conflicts noted and resolved: the downloaded HTML uses burnt-orange `#c85a17` / pine `#143d2b`, Space Grotesk / Mulish, and Material Symbols, which contradict the Stitch system (emerald / Geist / Phosphor) and DESIGN.md. This spec follows the Stitch *system* + DESIGN.md, not the HTML's off-palette values. The HTML is used only for information architecture (header / hero / stats numerals / photo rail / checkout split) and its 5 photos as static assets.

## 1. Global theme foundation

- Light-locked. `color-scheme: light`. Delete the dark-mode maroon `#D9475C` / gold `#F2BB5D` block in `app/globals.css`. Dark fallback (only for `prefers-color-scheme: dark`) mirrors emerald: accent `#34d399`, hover `#10b981`, surfaces stay near-white.
- Tokens (light): accent `#047857`, hover `#065f46`, pressed `#064e3b`, subtle `#ecfdf5`, line `#a7f3d0`; canvas `#fbfbfa`, card `#ffffff`, low `#f4f4f5`/`#fafafa`; border `#e4e4e7`; text `#18181b` / `#52525b` / muted `#71717a`; focus ring emerald.
- Status tones (DESIGN.md §2, exact): accepted/verified/escrow emerald bg `#ecfdf5` / border `#a7f3d0` / text `#047857`; review amber bg `#fffbeb` / border `#fde68a` / text `#b45309`; action-required orange bg `#fff7ed` / border `#fed7aa` / text `#c2410c` (new tone); rejected red bg `#fef2f2` / border `#fecaca` / text `#b91c1c`; neutral zinc. Info-blue (`--info`) is deleted and mapped to emerald. Add missing light `--success` (emerald set) — `contact/page.tsx` references `var(--success)` which does not exist in light mode today.
- Typography (full DESIGN.md): Inter body via `next/font/google`; Newsreader headlines via `next/font/google` with Georgia serif fallback for sovereign/hero H1 + H2 editorial; `ui-monospace` data (hashes, UTR, dossier IDs). Remove `Geist`/`Geist_Mono` from `app/layout.tsx`. Scale: H1 `text-3xl md:text-5xl font-bold tracking-tight leading-[1.15]`, H2 `text-2xl font-semibold tracking-tight`, H3 `text-base md:text-lg font-semibold tracking-tight`, body `text-sm leading-relaxed`, labels `text-xs font-medium`, eyebrows `text-xs uppercase tracking-wider font-semibold`.
- Radii: controls/buttons/inputs/tabs `rounded-lg` 8px; cards/tables/modals `rounded-xl` 12px; badges/avatars/counters `rounded-full`. Sweep and delete `rounded-2xl` (cards/CTAs in about/why-us/contact/CollegeLandingPage) and `rounded-xl` icon tiles → `rounded-lg`.
- Elevation: flat 1px `border-zinc-200` depth; hover `hover:border-zinc-300 transition-all duration-150` + optional `shadow-sm` only. Delete all `bg-gradient-to-*`, `bg-[radial-gradient(*)]`, `vignette`, `HeroGradient`, animated ShaderGradient. Photo overlays use flat `bg-black/50` (or ink/60), never gradient stacks.
- Icons: Phosphor only (`@phosphor-icons/react`). Replace `✉` fallback in `contact/page.tsx` with `EnvelopeSimple`. Remove Material Symbols references.

## 2. Core components

- `ui/Button.tsx`: keep API (`primary/secondary/ghost/danger`, `sm/md`, `loading`). Primary `bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm focus:ring-emerald-700`; secondary `text-zinc-700 bg-white border-zinc-200 hover:bg-zinc-50 rounded-lg`. Keep 8px, keep Phosphor `CircleNotch` spinner.
- `ui/Input.tsx` + `ui/Field.tsx`: `h-10 px-3 text-sm bg-white border-zinc-200 rounded-lg focus:ring-emerald-700/20 focus:border-emerald-700`.
- `ui/Badge.tsx`: pill only. Tones: neutral zinc, success emerald, warning amber-700, action orange-700 (new `action` tone), danger red-700. Delete `info` blue tone; remap `payment_received` to emerald/`info`→`success` in `lib/format.ts` `APPLICATION_STATUS_TONE`.
- `ui/Table.tsx`: `TableWrap` `rounded-lg` → `rounded-xl`, rows `border-zinc-100 hover:bg-zinc-50/75 px-4 py-3.5 text-sm`, `Th` zinc-50 labels. Page body never scrolls sideways; tables scroll in-container (keep).
- `ui/States.tsx`: unchanged API (`Skeleton`/`CardSkeleton`/`RowSkeleton`/`LoadingList`/`EmptyState`/`ErrorState`). Retoken to new palette. Every list keeps all four states (loading / empty / error / content) — already true per audit; implementation plan verifies each portal list rather than adding new states.
- Money: `lib/format.ts` `formatFee(paise)` stays the single rupee formatter (`Intl en-IN INR`, paise/100, `tabular` mono). All payment surfaces (student checkout/shortlist, admin payments, college courses, scholarship slabs) render through it. No floats, no rupee-stored values.

## 3. Shell and pages

- `shells/PortalShell.tsx` → sovereign shell (all four portals, identity via nav/content only): sidebar `w-64 bg-white border-r border-zinc-200`, active `bg-emerald-50 text-emerald-700 font-semibold rounded-lg px-3 py-2 text-sm gap-3`, inactive `text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 rounded-lg`; new sticky `h-16` header with search + `⌘K` tooltip, emerald sync pill, Phosphor bell, user credential badge; content `max-w-7xl mx-auto px-6 py-8` with KPI `StatTile` row, tabbed filtering, audit tables with direct actions. Keep mobile drawer behavior, restyled to w-64.
- Public/student gateway: sticky `h-16` nav (wordmark, portal switcher, breadcrumb, `Apply Now` / `Proceed to payment` primary). Hero reuses downloaded `stitch-assets/28b4334051cb4b66b62c7a7159f00c07-screenshot.png` (graduation) full-bleed + flat overlay; headline Newsreader per §1; search field `rounded-lg` (pill reserved for badges). Stats-numerals band and photo rail (Fergusson / Xavier's / Loyola / Amrita-Christ photos from `stitch-assets/`) as static images, no animation libs.
- Checkout: 2-column (programs + fee schedule left; escrow summary + volume scholarships + UPI/NetBanking rails right), all amounts via `formatFee`.
- Deletions: `ui/HeroGradient.tsx` (sole `@shadergradient/react` consumer, rendered only by `app/(public)/page.tsx`), deps `@shadergradient/react`, `three`, `@react-three/fiber`, `three-stdlib`, `camera-controls`, `@types/three` (verified zero code imports outside `package.json`), `vignette`/`hero-content`/`scale-hover` utilities, all gradient washes in `(public)` pages + `CollegeLandingPage`.
- Files touched: `app/globals.css`, `app/layout.tsx`, `components/ui/*` (Button, Input, Field, Badge, Table, States, BackLink, LinkButton, DetailList, StatTile, CollegeCard), `components/shells/*` (+ new header), `app/(public)/*` (page, about, why-us, contact, login, signup), `components/college/CollegeLandingPage.tsx`, `app/colleges/*`, `app/student/*`, `app/college/*`, `app/coaching/*`, `app/admin/*`, `lib/format.ts`, `lib/portals.ts`, `package.json`.

## 4. Data flow

No API or schema changes. Reads/writes unchanged (colleges, shortlists, orders/payments paise, applications, audit). Header search routes to the existing list query param (no new endpoint); bell renders counts derived from already-loaded lists; sync pill reflects the page's existing loading state. No new endpoints.

## 5. Error handling

Lists: `LoadingList` → content, or `EmptyState` (with action), or `ErrorState` with retry wired to existing `load()`/`reload()`. Forms: inline `ErrorState` + field errors, no emoji, no color-only signaling (badge text always states status). Payment failures keep existing Razorpay handler + webhook flow; UI shows red-700 error + retry, amounts re-rendered via `formatFee`.

## 6. Testing

- `npm run typecheck`, `npm run lint`, `npm run build` (frontend).
- `vitest run`: existing `format.test.ts` (paise), `CheckoutSummary.test.tsx`, `CollegeLandingPage.test.tsx` must pass; add/extend assertions for new orange tone, no-`rounded-2xl`, no-info-token, `formatFee` on checkout totals.
- Manual: each portal list visited in loading/empty/error/content; light + dark-preference both render emerald light theme; no gradient/neon/emoji; keyboard focus ring visible; `tabular` numerals on money.
