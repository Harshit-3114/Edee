import type { Metadata } from 'next';
import ApplicationDetailClient from './ApplicationDetailClient';

export const metadata: Metadata = { title: 'Application' };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <ApplicationDetailClient id={applicationId} />;
}
