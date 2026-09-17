import BackLink from '@/components/ui/BackLink';
import LinkButton from '@/components/ui/LinkButton';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { formatFee } from '@/lib/format';
import type { CollegeLanding } from '@/lib/types';
import Image from 'next/image';

/**
 * The public face of a college. Rendered for logged-out visitors, so it must
 * never show personal data — only the college's own listing, which is exactly
 * what GET /colleges/by-slug/:slug returns. Every number on this page is
 * computed from that payload; nothing is invented for effect.
 */
export default function CollegeLandingPage({ college }: { college: CollegeLanding }) {
  const openCourses = college.courses.filter((course) => course.active);
  const knownSeats = openCourses
    .map((course) => course.seats)
    .filter((seats): seats is number => typeof seats === 'number');
  const fees = openCourses.map((course) => course.application_fee);
  const lowestFee = fees.length > 0 ? Math.min(...fees) : null;
  const totalSeats = knownSeats.reduce((sum, s) => sum + s, 0);

  // Helper for staggered animation
  const stagger = (i: number) => ({ animationDelay: `${i * 100}ms` } as React.CSSProperties);

  return (
    <main id="main" className="mx-auto max-w-5xl px-6 py-10">
      <BackLink href="/" label="Home" />

      {/* Hero with optional image or gradient placeholder */}
      <section className="relative rounded-2xl overflow-hidden bg-[var(--surface-sunken)] animate-fade-up" style={stagger(0)}>
        {college.landing_hero_image_url ? (
          <Image
            src={college.landing_hero_image_url}
            alt=""
            fill
            priority
            className="object-cover opacity-90"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5" />
        )}
        <div className="relative p-8 md:p-12 hero-content">
          <p className="text-[13px] font-medium tracking-wide text-[var(--accent-text)] uppercase">
            {college.city}, {college.state} · {openCourses.length}{' '}
            {openCourses.length === 1 ? 'open course' : 'open courses'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            {college.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {college.location} · {college.type === 'government' ? 'Government' : college.type === 'deemed' ? 'Deemed university' : 'Private'}
          </p>
        </div>
        {/* bottom vignette */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--surface)] to-transparent pointer-events-none" />
      </section>

      {college.landing_description && (
        <section className="mt-10 animate-fade-up" style={stagger(1)}>
          <p className="max-w-[70ch] text-[15px] leading-relaxed">{college.landing_description}</p>
        </section>
      )}

      {/* Quick stats cards */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key figures">
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(2)}>
          <dt className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Open courses</dt>
          <dd className="mt-1 tabular text-2xl font-bold">{openCourses.length}</dd>
        </article>
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(3)}>
          <dt className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Total seats</dt>
          <dd className="mt-1 tabular text-2xl font-bold">{totalSeats.toLocaleString('en-IN') || '—'}</dd>
        </article>
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(4)}>
          <dt className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Lowest fee</dt>
          <dd className="mt-1 tabular text-2xl font-bold">{lowestFee ? formatFee(lowestFee) : '—'}</dd>
        </article>
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(5)}>
          <dt className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Streams</dt>
          <dd className="mt-1 tabular text-2xl font-bold">
            {[...new Set(openCourses.map(c => c.stream))].length}
          </dd>
        </article>
      </section>

      {/* Gallery */}
      {college.landing_gallery_urls && college.landing_gallery_urls.length > 0 && (
        <section className="mt-12 animate-fade-up" style={stagger(6)}>
          <h2 className="text-lg font-medium tracking-tight">Campus gallery</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {college.landing_gallery_urls.map((url, i) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-[var(--surface-sunken)] group animate-scale-in" style={{ animationDelay: `${i * 80}ms` }}>
                <Image
                  src={url}
                  alt={`${college.name} campus photo ${i + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Courses table */}
      <section className="mt-12 animate-fade-up" style={stagger(7)}>
        <h2 className="text-lg font-medium tracking-tight">Open courses</h2>
        {openCourses.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">No open courses right now. Check back soon.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <TableWrap>
              <Table>
                <caption className="sr-only">Open courses at {college.name}</caption>
<thead>
                    <tr>
                      <Th>Course</Th>
                      <Th>Stream</Th>
                      <Th numeric>Seats</Th>
                      <Th numeric>Fee</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {openCourses.map((course) => (
                      <Tr key={course.id}>
                        <Td><span className="font-medium">{course.course_name}</span></Td>
                        <Td>{course.stream}</Td>
                        <Td numeric>{course.seats ?? '-'}</Td>
                        <Td numeric>{formatFee(course.application_fee)}</Td>
                      </Tr>
                    ))}
                  </tbody>
              </Table>
            </TableWrap>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-12 animate-fade-up" style={stagger(8)}>
        <div className="rounded-2xl bg-[var(--accent-subtle)] px-6 py-8 md:px-10 md:py-12 border border-[var(--accent-line)]">
          <h2 className="text-base font-medium tracking-tight">Like what you see?</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            Shortlist these courses and pay once. The college sees your application the moment payment clears.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/student/colleges" className="btn">Shortlist courses</LinkButton>
            <LinkButton href="/signup" variant="secondary" className="btn">Create account</LinkButton>
          </div>
        </div>
      </section>
    </main>
  );
}
