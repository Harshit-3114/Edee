'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRole } from '@/hooks/useRole';
import { PORTAL_HOME, type Role } from '@/lib/portals';
import { Skeleton } from '@/components/ui/States';

/**
 * The client-side half of the role guard.
 *
 * middleware.ts reads a cookie the client wrote, which a determined user can
 * forge. This checks the role on the *verified* token instead, so a forged
 * cookie gets a redirect here even before the API starts returning 403s.
 */
export default function RoleGate({
  role,
  serverRole,
  children,
}: {
  role: Role;
  /**
   * The role the server already verified for this request, from the session
   * cookie. When it matches, the gate is open on the first paint - no
   * "Checking your access" while Firebase boots in the browser. The client
   * check below still runs and still redirects if it disagrees, so this
   * shortens the wait without becoming the thing that decides access.
   */
  serverRole?: Role | null;
  children: React.ReactNode;
}) {
  const { role: actual, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!actual) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    else if (actual !== role) router.replace(PORTAL_HOME[actual]);
  }, [actual, loading, role, router]);

  // Still resolving on the client, but the server vouched for this role.
  const serverVouched = loading && serverRole === role;

  if (!serverVouched && (loading || actual !== role)) {
    return (
      <div className="min-h-[100dvh] p-6" role="status" aria-live="polite">
        <span className="sr-only">Checking your access</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
