import BackLink from '@/components/ui/BackLink';
import LinkButton from '@/components/ui/LinkButton';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { formatFee } from '@/lib/format';
import type { CollegeLanding } from '@/lib/types';

/**
 * The public face of a college. Rendered for logged-out visitors, so it must
 * never show personal data — only the college's own listing, which is exactly
 * what GET /colleges/by-slug/:slug returns.
 */
export default function CollegeLandingPage({ college }: { college: CollegeLanding }) {
  const openCourses = college.courses.filter((course) => course.active);

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-10">
      <BackLink href="/" label="Home" />

      {college.landing_hero_image_url && (
        // Plain img on purpose: hero and gallery URLs are arbitrary
        // college-supplied addresses. Routing them through next/image would
        // turn the optimizer into an open image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={college.landing_hero_image_url}
          alt=""
          className="mt-6 aspect-[21/9] w-full rounded-lg object-cover"
        />
      )}

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{college.name}</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {college.location} · {college.city}, {college.state}
      </p>

      {college.landing_description && (
        <p className="mt-4 text-[15px] leading-relaxed">{college.landing_description}</p>
      )}

      {college.landing_gallery_urls && college.landing_gallery_urls.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {college.landing_gallery_urls.map((url) => (
            // See the hero image above: arbitrary external URLs stay on <img>.
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

      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/student/colleges">Shortlist courses</LinkButton>
        <LinkButton href="/signup" variant="secondary">
          Create account
        </LinkButton>
      </div>
      <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
        Signing in takes you to the student portal, where shortlisted courses can
        be paid for.
      </p>
    </main>
  );
}
