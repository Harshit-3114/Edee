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
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { role: actual, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!actual) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    else if (actual !== role) router.replace(PORTAL_HOME[actual]);
  }, [actual, loading, role, router]);

  if (loading || actual !== role) {
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
