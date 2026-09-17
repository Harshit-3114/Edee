import Image from 'next/image';
import { ArrowRight, Building, Heart, Lightbulb, Globe, Users } from '@phosphor-icons/react/dist/ssr';
import SiteHeader from '../_components/SiteHeader';
import SiteFooter from '../_components/SiteFooter';
import Reveal from '@/components/ui/Reveal';
import LinkButton from '@/components/ui/LinkButton';

const VALUES = [
  {
    icon: Heart,
    title: 'Student‑first',
    body: 'Every feature is designed to reduce stress, cost, and opacity for applicants.',
  },
  {
    icon: Lightbulb,
    title: 'Transparency',
    body: 'Fees, seat counts, and deadlines are pulled from official sources and shown verbatim.',
  },
  {
    icon: Globe,
    title: 'Nationwide reach',
    body: 'From metro universities to regional colleges – if it’s recognised, it’s on Edee Apply.',
  },
  {
    icon: Building,
    title: 'Partner integrity',
    body: 'Colleges pay only for qualified leads; we never sell student data.',
  },
];

const TEAM = [
  { name: 'Aarav Mehta', role: 'Co‑founder & CEO', avatar: '/images/team-aarav.jpg' },
  { name: 'Priya Nair', role: 'Co‑founder & CTO', avatar: '/images/team-priya.jpg' },
  { name: 'Rohan Desai', role: 'Head of Partnerships', avatar: '/images/team-rohan.jpg' },
  { name: 'Meera Iyer', role: 'Head of Product', avatar: '/images/team-meera.jpg' },
];

const MILESTONES = [
  { year: '2022', title: 'Idea born at a hackathon', desc: 'Three friends realised the pain of multiple application fees.' },
  { year: '2023', title: 'Beta launch with 50 colleges', desc: 'Processed 1,200 applications in the first month.' },
  { year: '2024', title: 'Nationwide rollout', desc: 'Crossed 10,000 listed courses and 15,000 active students.' },
  { year: '2025', title: 'Series‑A funding', desc: 'Backed by education‑focused VCs to scale verification engine.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[var(--surface-sunken)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_70%)] opacity-10" aria-hidden="true" />
          <div className="relative mx-auto max-w-5xl px-6 py-24 lg:py-32 text-center hero-content">
            <Reveal>
              <p className="text-[13px] font-medium tracking-wide text-[var(--accent-text)] uppercase">About Edee Apply</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                Making college admissions simple, fair, and fast.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-[55ch] mx-auto text-base leading-relaxed text-[var(--text-secondary)]">
                We’re a team of former applicants, engineers, and admission officers who believe the path to higher education shouldn’t be a maze of portals, hidden fees, and uncertainty.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Mission & values */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-center">Our guiding principles</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 80}>
                <article className="card animate-fade-up p-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                    <v.icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{v.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Milestones timeline */}
        <section className="border-y border-[var(--line)] bg-[var(--surface-sunken)]">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-center">Our journey so far</h2>
            </Reveal>
            <ol className="mt-12 relative">
              {/* vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-[var(--line-strong)] lg:left-[140px]" aria-hidden="true" />
{MILESTONES.map((m, i) => {
                return (
                  <Reveal key={m.year} delay={i * 100}>
                    <li className="relative pl-16 pb-10 lg:pl-[180px] animate-fade-up">
                      <div className="absolute left-2 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-sm font-bold lg:left-[132px]">
                        {m.year}
                      </div>
                      <h3 className="text-base font-semibold">{m.title}</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{m.desc}</p>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Team */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-center">The people behind the platform</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <article className="card animate-fade-up overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] text-center">
                  <div className="aspect-square w-full bg-[var(--surface-sunken)] relative">
                    {t.avatar && (
                      <Image
                        src={t.avatar}
                        alt={`${t.name} portrait`}
                        fill
                        className="object-cover transition-transform duration-500 hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    )}
                    {!t.avatar && (
                      <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                        <Users size={32} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{t.role}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24 text-center">
          <Reveal>
            <div className="rounded-2xl bg-[var(--accent-subtle)] px-6 py-10 md:px-12 md:py-16 border border-[var(--accent-line)] animate-scale-in">
              <h2 className="text-2xl font-semibold tracking-tight">Want to join the mission?</h2>
              <p className="mt-3 max-w-[48ch] mx-auto text-sm leading-relaxed text-[var(--text-secondary)]">
                We’re always looking for curious builders who care about education equity. Check our careers page or drop us a line.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <LinkButton href="/contact" className="btn" size="md">
                  Get in touch
                  <ArrowRight size={16} weight="bold" />
                </LinkButton>
                <LinkButton href="/colleges" variant="secondary" className="btn" size="md">
                  See the platform
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