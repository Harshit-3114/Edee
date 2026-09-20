import LandingBackLink from './LandingBackLink';
import LandingCta from './LandingCta';
import LandingShortlistButton from './LandingShortlistButton';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { apiFileUrl, formatDate, formatFee } from '@/lib/format';
import type { CollegeLanding } from '@/lib/types';
import Image from 'next/image';

/**
 * Public college landing page – mirrors the structure of
 * https://edee.in/university/srm-institute-of-science-and-technology/
 * All data comes from GET /colleges/by-slug/:slug (CollegeLanding).
 */
export default function CollegeLandingPage({ college }: { college: CollegeLanding }) {
  const openCourses = college.courses.filter((c) => c.active);
  const knownSeats = openCourses
    .map((c) => c.seats)
    .filter((s): s is number => typeof s === 'number');
  const fees = openCourses.map((c) => c.application_fee);
  const lowestFee = fees.length ? Math.min(...fees) : null;
  const totalSeats = knownSeats.reduce((a, b) => a + b, 0);

  const stagger = (i: number) => ({
    animationDelay: `${i * 80}ms`,
  } as React.CSSProperties);

  // Helper to build a safe embed URL from a plain YouTube link
  const embedUrl = (url?: string | null) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const id = u.searchParams.get('v') || u.pathname.split('/').pop();
      return `https://www.youtube.com/embed/${id}`;
    } catch {
      return url; // fallback – assume already embed
    }
  };

  return (
    <main id="main" className="mx-auto max-w-6xl px-6 py-10">
      <LandingBackLink />

      {/* ==================== HERO ==================== */}
      <section className="relative rounded-2xl overflow-hidden bg-[var(--surface-sunken)] animate-fade-up" style={stagger(0)}>
        {/* background image / gradient */}
        {college.landing_hero_image_url ? (
          <Image
            src={college.landing_hero_image_url}
            alt=""
            fill
            priority
            className="object-cover opacity-80"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-secondary)]/10" />
        )}
        <div className="relative p-8 md:p-12 grid lg:grid-cols-[1fr_1fr] gap-8 items-start">
          {/* left – identity */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              {apiFileUrl(college.logo_url) && (
                <Image
                  src={apiFileUrl(college.logo_url) as string}
                  alt={`${college.name} logo`}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg bg-white/90 object-contain p-1.5"
                  unoptimized
                />
              )}
              <div>
                <p className="text-[13px] font-medium tracking-wide uppercase text-[var(--accent-text)]">
                  {college.city}, {college.state}
                </p>
                <h1 className="mt-1 text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                  {college.name}
                </h1>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {college.location} ·{' '}
              {college.type === 'government' ? 'Government' : college.type === 'deemed' ? 'Deemed university' : 'Private'}
            </p>

            {/* quick meta chips */}
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--line)]">
                {openCourses.length} open course{openCourses.length !== 1 ? 's' : ''}
              </span>
              <span className="px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--line)]">
                {totalSeats.toLocaleString('en-IN')} total seats
              </span>
              {lowestFee && (
                <span className="px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--line)]">
                  Fees from {formatFee(lowestFee)}
                </span>
              )}
            </div>
          </div>

          {/* right – video */}
          {embedUrl(college.video_url) && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black/30">
              <iframe
                src={embedUrl(college.video_url)!}
                title={`${college.name} campus video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      </section>

      {/* ==================== OVERVIEW ==================== */}
      {(college.overview || college.landing_description) && (
        <section className="mt-12 animate-fade-up" style={stagger(1)}>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <div className="mt-4 prose prose-[var(--text-secondary)] max-w-none">
            {college.overview && <p className="text-[15px] leading-relaxed">{college.overview}</p>}
            {college.landing_description && (
              <p className="mt-3 text-[15px] leading-relaxed">{college.landing_description}</p>
            )}
          </div>
        </section>
      )}

      {/* ==================== ADMISSION PHASES ==================== */}
      {college.application_phases && (
        <section className="mt-10 animate-fade-up" style={stagger(2)}>
          <h2 className="text-xl font-semibold tracking-tight">Admission phases</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">{college.application_phases}</p>
        </section>
      )}

      {/* ==================== KEY STATS ==================== */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key figures">
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(3)}>
          <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Open courses</dt>
          <dd className="mt-1 tabular text-3xl font-bold">{openCourses.length}</dd>
        </article>
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(4)}>
          <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Total seats</dt>
          <dd className="mt-1 tabular text-3xl font-bold">{totalSeats.toLocaleString('en-IN') || '—'}</dd>
        </article>
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(5)}>
          <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Lowest fee</dt>
          <dd className="mt-1 tabular text-3xl font-bold">{lowestFee ? formatFee(lowestFee) : '—'}</dd>
        </article>
        <article className="card animate-fade-up p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]" style={stagger(6)}>
          <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Streams</dt>
          <dd className="mt-1 tabular text-3xl font-bold">
            {[...new Set(openCourses.map((c) => c.stream))].length}
          </dd>
        </article>
      </section>

      {/* ==================== GALLERY ==================== */}
      {college.landing_gallery_urls && college.landing_gallery_urls.length > 0 && (
        <section className="mt-12 animate-fade-up" style={stagger(7)}>
          <h2 className="text-xl font-semibold tracking-tight">Campus gallery</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {college.landing_gallery_urls.map((url, i) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-lg bg-[var(--surface-sunken)] group animate-scale-in"
                style={{ animationDelay: `${i * 70}ms` }}
              >
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

      {/* ==================== COURSES TABLE ==================== */}
      <section className="mt-12 animate-fade-up" style={stagger(8)}>
        <h2 className="text-xl font-semibold tracking-tight">Open courses</h2>
        {openCourses.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">No open courses at the moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <TableWrap>
              <Table>
                <caption className="sr-only">Open courses at {college.name}</caption>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Stream</Th>
                    <Th>Intake</Th>
                    <Th numeric>Seats</Th>
                    <Th numeric>Fee</Th>
                    <Th>Opens</Th>
                    <Th>Deadline</Th>
                    <Th>
                      <span className="sr-only">Shortlist</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {openCourses.map((course) => (
                    <Tr key={course.id}>
                      <Td><span className="font-medium">{course.course_name}</span></Td>
                      <Td>{course.stream}</Td>
                      <Td>{course.intake_info ?? '—'}</Td>
                      <Td numeric>{course.seats ?? '—'}</Td>
                      <Td numeric>{formatFee(course.application_fee)}</Td>
                      <Td>
                        {course.application_start_date
                          ? formatDate(course.application_start_date)
                          : 'Open'}
                      </Td>
                      <Td>
                        {course.closing_date ? formatDate(course.closing_date) : 'No deadline'}
                      </Td>
                      <Td>
                        <LandingShortlistButton
                          collegeId={course.college_id}
                          courseId={course.id}
                          courseName={`${course.course_name} at ${college.name}`}
                          slug={college.slug}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        )}
      </section>

      {/* ==================== FAQs ==================== */}
      {college.faqs && college.faqs.length > 0 && (
        <section className="mt-12 animate-fade-up" style={stagger(9)}>
          <h2 className="text-xl font-semibold tracking-tight">Frequently asked questions</h2>
          <dl className="mt-4 space-y-3">
            {college.faqs.map((faq, i) => (
              <details
                key={i}
                className="group border border-[var(--line)] rounded-xl bg-[var(--surface-raised)] p-4 animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <summary className="cursor-pointer font-medium list-none flex items-center justify-between">
                  {faq.question}
                  <svg
                    className="w-5 h-5 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <dd className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {faq.answer}
                </dd>
              </details>
            ))}
          </dl>
        </section>
      )}

      {/* ==================== CTA ==================== */}
      <section className="mt-12 animate-fade-up" style={stagger(10)}>
        <div className="rounded-2xl bg-[var(--accent-subtle)] px-6 py-8 md:px-10 md:py-12 border border-[var(--accent-line)]">
          <h2 className="text-base font-medium tracking-tight">Like what you see?</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            Shortlist these courses and pay once. The college sees your application the moment payment clears.
          </p>
          <LandingCta />
        </div>
      </section>
    </main>
  );
}