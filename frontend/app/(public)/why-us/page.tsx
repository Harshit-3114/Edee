import { ArrowRight, Shield, Users, Clock, GraduationCap } from '@phosphor-icons/react/dist/ssr';
import SiteHeader from '../_components/SiteHeader';
import SiteFooter from '../_components/SiteFooter';
import Reveal from '@/components/ui/Reveal';
import LinkButton from '@/components/ui/LinkButton';

const FEATURES = [
  {
    icon: Shield,
    title: 'Verified listings only',
    body: 'Every college and course is cross‑checked with the official regulator data before it goes live.',
  },
  {
    icon: Users,
    title: 'One payment, many applications',
    body: 'Shortlist any number of courses and pay a single consolidated fee – no hidden charges.',
  },
  {
    icon: Clock,
    title: 'Real‑time status',
    body: 'Track every application from submission to decision in one dashboard, with instant notifications.',
  },
  {
    icon: GraduationCap,
    title: 'Built for students, not agents',
    body: 'No spam, no upsells. The platform earns only when a college confirms a seat.',
  },
];

const STATS = [
  { label: 'Colleges onboarded', value: '1,200+' },
  { label: 'Courses listed', value: '9,800+' },
  { label: 'Applications processed', value: '42,000+' },
  { label: 'Students helped', value: '18,500+' },
];

export default function WhyUsPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[var(--surface-sunken)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_70%)] opacity-10" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32 text-center hero-content">
            <Reveal>
              <p className="text-[13px] font-medium tracking-wide text-[var(--accent-text)] uppercase">Why choose Edee Apply?</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                One platform. Every college. Zero hassle.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-[55ch] mx-auto text-base leading-relaxed text-[var(--text-secondary)]">
                We aggregate every UG & PG seat in India, verify the data, and let you apply to as many programmes as you want with a single payment.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <LinkButton href="/login" className="btn" size="md">
                  Start your shortlist
                  <ArrowRight size={16} weight="bold" />
                </LinkButton>
                <LinkButton href="/colleges" variant="secondary" className="btn" size="md">
                  Browse colleges
                </LinkButton>
              </div>
            </Reveal>
          </div>

          {/* decorative illustration placeholder */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-48 bg-gradient-to-t from-[var(--surface)] to-transparent pointer-events-none" aria-hidden="true" />
        </section>

        {/* Stats bar */}
        <section className="border-y border-[var(--line)] bg-[var(--surface-raised)]">
          <div className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
            <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4" role="list">
              {STATS.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 60}>
                  <li className="text-center animate-fade-up">
                    <dt className="tabular text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">{stat.value}</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{stat.label}</dd>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Features grid */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-center">What makes us different</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <article className="card animate-fade-up p-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                    <f.icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Process steps */}
        <section className="border-t border-[var(--line)] bg-[var(--surface-sunken)]">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-center">How it works in 4 steps</h2>
            </Reveal>
            <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                { number: '01', title: 'Discover', desc: 'Filter colleges by stream, state, type, fees – all verified.' },
                { number: '02', title: 'Shortlist', desc: 'Add courses to your list; see a live total of fees.' },
                { number: '03', title: 'Pay once', desc: 'One Razorpay transaction files every application.' },
                { number: '04', title: 'Track', desc: 'Real‑time status, document requests, and final decisions.' },
].map((step, i) => {
                return (
                  <Reveal key={step.title} delay={i * 80}>
                    <li className="relative animate-fade-up">
                      <span className="absolute -top-2 -left-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-sm font-bold">
                        {step.number}
                      </span>
                      <div className="pt-8 pl-2">
                        <h3 className="text-base font-semibold">{step.title}</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{step.desc}</p>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24 text-center">
          <Reveal>
            <div className="rounded-2xl bg-[var(--accent-subtle)] px-6 py-10 md:px-12 md:py-16 border border-[var(--accent-line)] animate-scale-in">
              <h2 className="text-2xl font-semibold tracking-tight">Ready to simplify your admissions?</h2>
              <p className="mt-3 max-w-[48ch] mx-auto text-sm leading-relaxed text-[var(--text-secondary)]">
                Create a free account, build your shortlist, and pay once. Colleges see your application the moment payment clears.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <LinkButton href="/login" className="btn" size="md">
                  Get started free
                  <ArrowRight size={16} weight="bold" />
                </LinkButton>
                <LinkButton href="/colleges" variant="secondary" className="btn" size="md">
                  Explore colleges
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