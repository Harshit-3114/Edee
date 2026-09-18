import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BookmarkSimple,
  Buildings,
  CreditCard,
  GraduationCap,
  LockSimple,
  MagnifyingGlass,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import LinkButton from '@/components/ui/LinkButton';
import Reveal from '@/components/ui/Reveal';
import SiteFooter from './_components/SiteFooter';
import SiteHeader from './_components/SiteHeader';
import { FAQS } from './_components/faqs';

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

const FLOW = [
  {
    icon: MagnifyingGlass,
    title: 'Search courses',
    body: 'Filter courses across streams, states and college types.',
  },
  {
    icon: BookmarkSimple,
    title: 'Shortlist what fits',
    body: 'One list holds every course you want, with a running total.',
  },
  {
    icon: LockSimple,
    title: 'Pay once, securely',
    body: 'A single Razorpay payment files all your applications.',
  },
];

const AUDIENCES = [
  {
    icon: Buildings,
    title: 'Colleges',
    body: 'Publish courses and fees, review only the applications students have paid for, and keep your landing page current.',
  },
  {
    icon: UsersThree,
    title: 'Coaching centres',
    body: 'Follow your batch from signup to admission with a read-only view of their shortlists and decisions.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main id="main">
        <div className="relative min-h-[80vh] flex items-center overflow-hidden bg-[var(--surface-sunken)]">
          <Image
            src="/campuses/graduation.jpg"
            alt="Graduates celebrating on a historic Indian university quadrangle"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24 w-full">
            <div className="rise">
              <p className="text-[13px] font-medium tracking-wide text-white/80 uppercase">
                UG and PG admissions, in one place
              </p>
              <h1 className="mt-3 max-w-[15ch] font-serif text-4xl leading-[1.08] font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                Apply to every college on one list
              </h1>
              <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-white/85">
                Search UG and PG courses across India, shortlist what fits, and pay all your
                application fees in a single transaction.
              </p>
<div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/login" className="btn">
                Get started
                <ArrowRight size={15} weight="bold" />
              </LinkButton>
              <LinkButton href="#how-it-works" variant="secondary" className="btn">
                See how it works
              </LinkButton>
            </div>
            </div>

            <div
              aria-label="How Edee Apply works: search courses, shortlist what fits, pay once securely"
              role="img"
              className="rise rounded-lg border border-[var(--line)] bg-[var(--surface-sunken)] p-5 sm:p-6"
              style={{ animationDelay: '120ms' }}
            >
              <div className="flex flex-col gap-3">
                {FLOW.map(({ icon: Icon, title, body }, index) => (
                  <div key={title} className="relative flex gap-4">
                    {index < FLOW.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-11 bottom-[-14px] left-[17px] w-px bg-[var(--line-strong)]"
                      />
                    )}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[var(--accent-text)] ring-1 ring-[var(--line-strong)]">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)] card">
                      <span className="block text-sm font-medium">
                        {index + 1}. {title}
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text-secondary)]">
                        {body}
                      </span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--accent)] p-4 text-[var(--text-inverse)] shadow-[var(--shadow-md)]">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <GraduationCap size={16} aria-hidden="true" />
                    One list, one payment, every application tracked
                  </span>
                  <ArrowRight size={15} weight="bold" aria-hidden="true" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="scroll-mt-16 border-t border-[var(--line)] bg-[var(--surface-sunken)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <Reveal>
              <h2
                id="how-it-works-heading"
                className="font-serif text-3xl font-semibold tracking-tight md:text-4xl"
              >
                Three steps, one payment
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <Reveal key={title} delay={index * 90}>
                  <div className="border-t border-[var(--line-strong)] pt-5">
                    <Icon size={20} className="text-[var(--accent-text)]" aria-hidden="true" />
                    <h3 className="mt-3 text-base font-medium">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="who-its-for"
          className="relative overflow-hidden"
        >
          <Image
            src="/campuses/christ.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70"
          />
          <div className="relative mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.05fr]">
            <Reveal>
              <div>
                <h2
                  id="who-its-for"
                  className="max-w-[18ch] font-serif text-3xl font-semibold tracking-tight text-white md:text-4xl"
                >
                  Built for students first
                </h2>
                <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-white/85">
                  One dashboard holds your shortlist, your payments, and every decision a
                  college makes. Withdraw anything undecided, and never pay twice for the
                  same course.
                </p>
                <p className="mt-6">
                  <LinkButton href="/login" className="btn">
                    Start your shortlist
                    <ArrowRight size={15} weight="bold" />
                  </LinkButton>
                </p>
              </div>
            </Reveal>

            <div className="flex flex-col gap-4">
              {AUDIENCES.map(({ icon: Icon, title, body }, index) => (
                <Reveal key={title} delay={index * 90}>
                  <div className="rounded-xl border border-white/20 bg-white/95 p-5 backdrop-blur-sm">
                    <h3 className="flex items-center gap-2 text-base font-medium text-[var(--text-primary)]">
                      <Icon size={18} className="text-[var(--accent-text)]" aria-hidden="true" />
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          </div>
        </section>

        <section
          aria-labelledby="faq"
        >
          <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
            <Reveal>
              <h2 id="faq" className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                FAQs
              </h2>
            </Reveal>
            <div className="mt-8 flex flex-col gap-3">
              {FAQS.map((faq) => (
                <Reveal key={faq.question}>
                  <details className="group rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-5 py-4">
                    <summary className="cursor-pointer text-[15px] font-medium marker:text-[var(--accent-text)]">
                      {faq.question}
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {faq.answer}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <p className="mt-6 text-sm">
                <Link
                  href="/faq"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--accent-text)] underline underline-offset-4"
                >
                  Read all frequently asked questions
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </p>
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="get-started" className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <Reveal>
            <div className="grid items-center gap-8 rounded-lg bg-[var(--accent)] px-8 py-10 text-[var(--text-inverse)] sm:px-12 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 id="get-started" className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Your shortlist is waiting
                </h2>
                <p className="mt-3 max-w-[48ch] text-sm leading-relaxed opacity-90">
                  Sign in, save the courses you want, and pay once. Colleges see your
                  application the moment payment clears.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <LinkButton
                  href="/login"
                  className="border-transparent bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] btn"
                >
                  Get started
                  <ArrowRight size={15} weight="bold" />
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
