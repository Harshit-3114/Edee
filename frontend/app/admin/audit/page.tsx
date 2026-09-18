import { serverGet } from '@/lib/serverApi';
import AdminAuditClient, { type InitialData } from './AdminAuditClient';

/**
 * The unfiltered list, fetched here on the server with the session cookie.
 * Filters are applied by the client half, which refetches as they change.
 */
export default async function Page() {
  const initialEvents = await serverGet<InitialData>('/admin/audit');

  return <AdminAuditClient initialEvents={initialEvents} />;
}
