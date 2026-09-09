import type { Metadata } from 'next';
import StudentDetailClient from './StudentDetailClient';

export const metadata: Metadata = { title: 'Student' };

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <StudentDetailClient id={studentId} />;
}
