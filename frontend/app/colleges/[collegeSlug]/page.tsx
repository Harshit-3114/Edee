import type { Metadata } from 'next';
import CollegeLandingClient from './CollegeLandingClient';

export const metadata: Metadata = { title: 'College' };

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
  return <CollegeLandingClient slug={collegeSlug} />;
}
