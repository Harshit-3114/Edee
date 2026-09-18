import { serverGet } from '@/lib/serverApi';
import CollegeCoursesClient, { type InitialData } from './CollegeCoursesClient';

/**
 * Fetched here, on the server, with the session cookie - so the page arrives
 * with its data in it instead of asking for it after hydration.
 *
 * serverGet returns null rather than throwing when there is no usable session,
 * and the client half fetches for itself in that case.
 */
export default async function Page() {
  const initialCourses = await serverGet<InitialData>('/college/courses');

  return (
    <CollegeCoursesClient initialCourses={initialCourses} />
  );
}
