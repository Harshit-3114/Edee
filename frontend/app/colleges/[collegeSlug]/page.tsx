import type { Metadata } from 'next';
import FloatingUserMenu from '@/components/shells/FloatingUserMenu';
import CollegeLandingClient from './CollegeLandingClient';
import { publicGet } from '@/lib/serverApi';
import type { CollegeLanding } from '@/lib/types';

export const metadata: Metadata = { title: 'College' };

/**
 * Rendered per request, not baked at build time.
 *
 * An admin edit must show up here immediately: prerendering (or ISR) would
 * freeze the old copy into the HTML, and the client below keeps whatever the
 * server served without refetching. Same treatment as the /colleges catalogue
 * page - the Cache-Control in next.config does the caching, so nothing stale
 * can be frozen into the page itself.
 */
export const dynamic = 'force-dynamic';

/**
 * Public landing page: one per college, reachable without signing in.
 * Deliberately outside every /student, /college, /coaching and /admin prefix,
 * so the edge middleware and RoleGate both leave it alone.
 */
export default async function CollegeLandingPageRoute({
  params,
}: {
  params: Promise<{ collegeSlug: string }>;
}) {
  const { collegeSlug } = await params;
  const initialCollege = await publicGet<CollegeLanding>(
    `/colleges/by-slug/${encodeURIComponent(collegeSlug)}`,
  );
  return (
    <>
      <FloatingUserMenu />
      <CollegeLandingClient slug={collegeSlug} initialCollege={initialCollege} />
    </>
  );
}
