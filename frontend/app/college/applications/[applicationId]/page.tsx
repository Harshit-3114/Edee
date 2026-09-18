import type { Metadata } from 'next';
import ApplicationDetailClient, { type InitialData } from './ApplicationDetailClient';
import { serverGet } from '@/lib/serverApi';

export const metadata: Metadata = { title: 'Application' };

/**
 * Fetched here, on the server, with the session cookie - so the record is in
 * the first response rather than requested after hydration.
 */
export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const initial = await serverGet<InitialData>(
    `/college/applications/${applicationId}`,
  );

  return <ApplicationDetailClient id={applicationId} initialApplication={initial} />;
}
