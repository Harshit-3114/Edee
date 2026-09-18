import { serverGet } from '@/lib/serverApi';
import AdminUsersClient, { type InitialData } from './AdminUsersClient';

/**
 * Fetched here, on the server, with the session cookie - so the page arrives
 * with its data in it instead of asking for it after hydration.
 *
 * serverGet returns null rather than throwing when there is no usable session,
 * and the client half fetches for itself in that case.
 */
export default async function Page() {
  const initialUsers = await serverGet<InitialData>('/admin/users');

  return (
    <AdminUsersClient initialUsers={initialUsers} />
  );
}
