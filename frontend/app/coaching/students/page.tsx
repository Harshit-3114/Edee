import { serverGet } from '@/lib/serverApi';
import CoachingStudentsClient from './CoachingStudentsClient';
import type { CohortStudent } from '@/lib/types';

/**
 * The unfiltered cohort, fetched here on the server with the session cookie.
 */
export default async function Page() {
  const initialStudents = await serverGet<CohortStudent[]>('/coaching/students');

  return <CoachingStudentsClient initialStudents={initialStudents} />;
}
