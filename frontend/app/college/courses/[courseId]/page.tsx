import type { Metadata } from 'next';
import CourseDetailClient from './CourseDetailClient';

export const metadata: Metadata = { title: 'Course' };

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseDetailClient id={courseId} />;
}
