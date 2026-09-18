import type { Metadata } from 'next';
import StudentDetailClient, { type InitialData } from './StudentDetailClient';
import { serverGet } from '@/lib/serverApi';

export const metadata: Metadata = { title: 'Student' };

/**
 * Fetched here, on the server, with the session cookie - so the record is in
 * the first response rather than requested after hydration.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const initial = await serverGet<InitialData>(
    `/coaching/students/${studentId}`,
  );

  return <StudentDetailClient id={studentId} initialStudent={initial} />;
}
