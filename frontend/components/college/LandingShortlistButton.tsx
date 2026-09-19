'use client';

import LinkButton from '@/components/ui/LinkButton';
import ShortlistButton from '@/components/student/ShortlistButton';
import Button from '@/components/ui/Button';
import { useShortlist } from '@/hooks/useShortlist';
import { useRole } from '@/hooks/useRole';

/**
 * Shortlist action inside the public landing table.
 *
 * A signed-out visitor gets a sign-in link that returns them here
 * afterwards; a signed-in student gets the same toggle the colleges
 * browser uses. Any other role sees nothing - shortlisting is a
 * student-only action and a dead button would only confuse.
 */
export default function LandingShortlistButton({
  collegeId,
  courseId,
  courseName,
  slug,
}: {
  collegeId: string;
  courseId: string;
  courseName: string;
  slug: string;
}) {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <Button size="sm" variant="primary" disabled>
        Shortlist
      </Button>
    );
  }

  if (role !== 'student') {
    if (role !== null) return null;
    return (
      <LinkButton size="sm" href={`/login?next=/colleges/${slug}`}>
        Shortlist
      </LinkButton>
    );
  }

  return (
    <StudentToggle collegeId={collegeId} courseId={courseId} courseName={courseName} />
  );
}

function StudentToggle({
  collegeId,
  courseId,
  courseName,
}: {
  collegeId: string;
  courseId: string;
  courseName: string;
}) {
  const shortlist = useShortlist();
  return (
    <ShortlistButton
      courseName={courseName}
      shortlisted={shortlist.has(courseId)}
      pending={shortlist.pending.has(courseId)}
      onToggle={() => void shortlist.toggle(collegeId, courseId)}
    />
  );
}
