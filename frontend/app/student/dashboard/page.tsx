import { Suspense } from 'react';
import StudentDashboardClient from './StudentDashboardClient';
import { serverGet } from '@/lib/serverApi';
import type { Application } from '@/lib/types';

/**
 * Fetched here, on the server, with the session cookie.
 *
 * Before this the page shipped empty and asked for its own data after
 * hydration: JS parse, then the role check, then a token read, then the
 * request. The list now arrives in the first response.
 *
 * serverGet returns null rather than throwing when there is no usable session,
 * and the client component falls back to fetching for itself - so a lapsed
 * cookie degrades to the old behaviour instead of an error page.
 */
export default async function StudentDashboardPage() {
  const applications = await serverGet<Application[]>('/students/me/applications');

  return (
    <Suspense fallback={null}>
      <StudentDashboardClient initialApplications={applications} />
    </Suspense>
  );
}
