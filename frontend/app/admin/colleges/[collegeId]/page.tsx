import type { Metadata } from 'next';
import CollegeDetailClient, { type InitialData } from './CollegeDetailClient';
import { serverGet } from '@/lib/serverApi';

export const metadata: Metadata = { title: 'College' };

/**
 * Fetched here, on the server, with the session cookie - so the record is in
 * the first response rather than requested after hydration.
 */
export default async function CollegeDetailPage({
  params,
}: {
  params: Promise<{ collegeId: string }>;
}) {
  const { collegeId } = await params;
  const initial = await serverGet<InitialData>(
    `/admin/colleges/${collegeId}`,
  );

  return <CollegeDetailClient id={collegeId} initialCollege={initial} />;
}
