import BackLink from '@/components/ui/BackLink';
import LinkButton from '@/components/ui/LinkButton';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { formatFee } from '@/lib/format';
import type { CollegeLanding } from '@/lib/types';

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

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-10">
      <BackLink href="/" label="Home" />

      <p className="mt-6 text-[13px] font-medium tracking-wide text-[var(--accent-text)] uppercase">
        {college.city}, {college.state} · {openCourses.length}{' '}
        {openCourses.length === 1 ? 'open course' : 'open courses'}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        {college.name}
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {college.location} · {college.type === 'government' ? 'Government' : college.type === 'deemed' ? 'Deemed university' : 'Private'}
      </p>

      {college.landing_description && (
        <p className="mt-5 max-w-[65ch] text-[15px] leading-relaxed">
          {college.landing_description}
        </p>
      )}

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-y border-[var(--line)] py-4">
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Open courses</dt>
          <dd className="tabular mt-0.5 text-lg font-medium">{openCourses.length}</dd>
        </div>
        {knownSeats.length > 0 && (
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Seats listed</dt>
            <dd className="tabular mt-0.5 text-lg font-medium">
              {knownSeats.reduce((sum, seats) => sum + seats, 0).toLocaleString('en-IN')}
            </dd>
          </div>
        )}
        {lowestFee !== null && (
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Fees from</dt>
            <dd className="tabular mt-0.5 text-lg font-medium">{formatFee(lowestFee)}</dd>
          </div>
        )}
      </dl>

      {college.landing_hero_image_url && (
        // Plain img on purpose (see CollegeLandingClient): college-supplied
        // artwork must not pass through the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={college.landing_hero_image_url}
          alt=""
          className="mt-6 aspect-[21/9] w-full rounded-lg object-cover"
        />
      )}

      {college.landing_gallery_urls && college.landing_gallery_urls.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {college.landing_gallery_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`${college.name} campus photo`}
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-medium tracking-tight">Open courses</h2>
      {openCourses.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          No open courses right now. Check back soon.
        </p>
      ) : (
        <div className="mt-4">
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
                    <Td>
                      <span className="font-medium">{course.course_name}</span>
                    </Td>
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

      <div className="mt-8 rounded-lg bg-[var(--accent-subtle)] px-6 py-6">
        <h2 className="text-base font-medium tracking-tight">Like what you see?</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
          Shortlist these courses and pay once. The college sees your application
          the moment payment clears.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <LinkButton href="/student/colleges">Shortlist courses</LinkButton>
          <LinkButton href="/signup" variant="secondary">
            Create account
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
