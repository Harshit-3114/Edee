import { serverGet } from '@/lib/serverApi';
import AdminStudentsClient, { type InitialData } from './AdminStudentsClient';

/**
 * The unfiltered list, fetched here on the server with the session cookie.
 * Filters are applied by the client half, which refetches as they change.
 */
export default async function Page() {
  const initialStudents = await serverGet<InitialData>('/admin/students');

  return <AdminStudentsClient initialStudents={initialStudents} />;
}
