import type { Metadata } from 'next';
import CourseDetailClient, { type InitialData } from './CourseDetailClient';
import { serverGet } from '@/lib/serverApi';

export const metadata: Metadata = { title: 'Course' };

/**
 * Fetched here, on the server, with the session cookie - so the record is in
 * the first response rather than requested after hydration.
 */
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const initial = await serverGet<InitialData>(
    `/college/courses/${courseId}`,
  );

  return <CourseDetailClient id={courseId} initialCourse={initial} />;
}
