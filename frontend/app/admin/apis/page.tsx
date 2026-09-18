import { serverGet } from '@/lib/serverApi';
import AdminApisClient, { type InitialData } from './AdminApisClient';

/**
 * The first round of integration checks runs here, on the server, so the page
 * arrives with its verdicts already in it.
 */
export default async function Page() {
  const initialStatus = await serverGet<InitialData>('/admin/system');

  return <AdminApisClient initialStatus={initialStatus} />;
}
