import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookmarkSimple,
  CreditCard,
  MagnifyingGlass,
} from '@phosphor-icons/react/dist/ssr';
import LinkButton from '@/components/ui/LinkButton';

const STEPS = [
  {
    icon: MagnifyingGlass,
    title: 'Search',
    body: 'Filter by stream, state and college type. Every listing shows the courses on offer and what applying costs.',
  },
  {
    icon: BookmarkSimple,
    title: 'Shortlist',
    body: 'Collect the courses you want in one list, with a running total so there are no surprises at checkout.',
  },
  {
    icon: CreditCard,
    title: 'Pay once',
    body: 'One payment covers every application on your shortlist. Track each one from your dashboard.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh]">
      <header className="border-b border-[var(--line)]">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
        >
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Sahayak
          </Link>
          <LinkButton href="/login" size="sm">
            Sign in
          </LinkButton>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <h1 className="max-w-[15ch] text-4xl leading-[1.08] font-semibold tracking-tight md:text-5xl lg:text-6xl">
              Apply to every college on one list
            </h1>
            <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-[var(--text-secondary)]">
              Search UG and PG courses across India, shortlist what fits, and pay all your
              application fees in a single transaction.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/login">
                Get started
                <ArrowRight size={15} weight="bold" />
              </LinkButton>
              <LinkButton href="/login" variant="secondary">
                College or coaching sign in
              </LinkButton>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--line)]">
            <Image
              src="https://picsum.photos/seed/india-university-campus-students/1200/900"
              alt="Students walking through a university campus"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover"
            />
          </div>
        </section>

        <section
          aria-labelledby="how-it-works"
          className="border-t border-[var(--line)] bg-[var(--surface-sunken)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
              Three steps, one payment
            </h2>

            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="border-t border-[var(--line-strong)] pt-5">
                  <Icon size={20} className="text-[var(--accent-text)]" aria-hidden="true" />
                  <h3 className="mt-3 text-base font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
            <div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-[var(--line)] lg:order-last">
              <Image
                src="https://picsum.photos/seed/college-admissions-office-desk/1000/667"
                alt="An admissions office reviewing applications"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover"
              />
            </div>

            <div>
              <h2 className="max-w-[18ch] text-2xl font-semibold tracking-tight md:text-3xl">
                Colleges and coaching centres work here too
              </h2>
              <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-[var(--text-secondary)]">
                Colleges manage their courses and review applicants as fees clear. Coaching
                centres follow their batch from signup to admission. Each gets its own
                sign-in, created by the platform team.
              </p>
              <p className="mt-6 text-sm">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--accent-text)] underline underline-offset-4"
                >
                  Sign in to your portal
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-[13px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Sahayak Admissions</p>
          <p>Application fees are set by each college and are not refundable.</p>
        </div>
      </footer>
    </div>
  );
}
