'use client';

import LinkButton from '@/components/ui/LinkButton';
import { useRole } from '@/hooks/useRole';
import { PORTAL_HOME } from '@/lib/portals';

/**
 * The call to action at the foot of a public college landing page.
 *
 * "Create account" is for visitors who do not have one. Showing it to someone
 * already signed in is both wrong and, since /signup now turns them away, a
 * dead end - so a signed-in visitor gets a route into their own portal instead.
 */
export default function LandingCta() {
  const { role, loading } = useRole();

  if (!loading && role) {
    return (
      <div className="mt-5 flex flex-wrap gap-3">
        <LinkButton prefetch={false} href="/student/colleges" className="btn">
          Shortlist courses
        </LinkButton>
        <LinkButton prefetch={false} href={PORTAL_HOME[role]} variant="secondary" className="btn">
          Go to your portal
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <LinkButton prefetch={false} href="/student/colleges" className="btn">
        Shortlist courses
      </LinkButton>
      <LinkButton prefetch={false} href="/signup" variant="secondary" className="btn">
        Create account
      </LinkButton>
    </div>
  );
}
