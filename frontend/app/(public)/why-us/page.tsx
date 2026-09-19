import Image from 'next/image';
import { ArrowRight, Shield, Users, Clock, GraduationCap } from '@phosphor-icons/react/dist/ssr';
import SiteHeader from '../_components/SiteHeader';
import SiteFooter from '../_components/SiteFooter';
import Reveal from '@/components/ui/Reveal';
import PhotoCard from '@/components/ui/PhotoCard';
import ScrollProgress from '@/components/ui/ScrollProgress';
import LinkButton from '@/components/ui/LinkButton';

const VALUE_PHOTOS = [
  '/campuses/graduation.jpg',
  '/campuses/fergusson.jpg',
  '/campuses/xaviers.jpg',
  '/campuses/loyola.jpg',
];

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
    title: 'One dashboard',
    body: 'Shortlist, pay and see every application you have filed in one place, with instant confirmations.',
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
        <section className="relative overflow-hidden">
          <Image
            src="/campuses/loyola.jpg"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70"
          />
          <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32 text-center">
            <Reveal>
              <p className="text-[13px] font-medium tracking-wide text-white/70 uppercase">Why choose Edee Apply?</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
                One platform. Every college. Zero hassle.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-[55ch] mx-auto text-base leading-relaxed text-white/85">
                We aggregate every UG & PG seat in India, verify the data, and let you apply to as many programmes as you want with a single payment.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <LinkButton prefetch={false} href="/login" className="btn" size="md">
                  Start your shortlist
                  <ArrowRight size={16} weight="bold" />
                </LinkButton>
                <LinkButton prefetch={false} href="/colleges" variant="secondary" className="btn" size="md">
                  Browse colleges
                </LinkButton>
              </div>
            </Reveal>
          </div>
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
                <PhotoCard
                  image={VALUE_PHOTOS[i % VALUE_PHOTOS.length]}
                  title={f.title}
                  body={f.body}
                  icon={<f.icon size={22} aria-hidden="true" />}
                />
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
            <ol className="relative mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <ScrollProgress />
              <ScrollProgress vertical />
              {[
                { number: '01', title: 'Discover', desc: 'Filter colleges by stream, state, type, fees – all verified.' },
                { number: '02', title: 'Shortlist', desc: 'Add courses to your list; see a live total of fees.' },
                { number: '03', title: 'Pay once', desc: 'One Razorpay transaction files every application.' },
                { number: '04', title: 'Track', desc: 'Real‑time status, document requests, and final decisions.' },
].map((step, i) => {
                return (
                  <Reveal key={step.title} delay={i * 120}>
                    <li className="relative">
                      <span
                        className="pop absolute -top-2 -left-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-sm font-bold ring-4 ring-white"
                        style={{ animationDelay: `${200 + i * 120}ms` }}
                      >
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
            <div className="relative overflow-hidden rounded-xl px-6 py-10 md:px-12 md:py-16 animate-scale-in">
              <Image
                src="/campuses/graduation.jpg"
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 1024px) 100vw, 72rem"
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70"
              />
              <div className="relative">
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-white md:text-3xl">Ready to simplify your admissions?</h2>
              <p className="mt-3 max-w-[48ch] mx-auto text-sm leading-relaxed text-white/85">
                Create a free account, build your shortlist, and pay once. Colleges see your application the moment payment clears.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <LinkButton prefetch={false} href="/login" className="btn" size="md">
                  Get started free
                  <ArrowRight size={16} weight="bold" />
                </LinkButton>
                <LinkButton prefetch={false} href="/colleges" variant="secondary" className="btn border-white/30 bg-white/95" size="md">
                  Explore colleges
                </LinkButton>
              </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}