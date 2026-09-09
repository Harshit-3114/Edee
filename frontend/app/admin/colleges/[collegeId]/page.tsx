import type { Metadata } from 'next';
import CollegeDetailClient from './CollegeDetailClient';

export const metadata: Metadata = { title: 'College' };

export default async function CollegeDetailPage({
  params,
}: {
  params: Promise<{ collegeId: string }>;
}) {
  const { collegeId } = await params;
  return <CollegeDetailClient id={collegeId} />;
}
