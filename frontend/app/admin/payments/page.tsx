import { serverGet } from '@/lib/serverApi';
import AdminPaymentsClient, { type InitialData } from './AdminPaymentsClient';

/**
 * The unfiltered list, fetched here on the server with the session cookie.
 * Filters are applied by the client half, which refetches as they change.
 */
export default async function Page() {
  const initialPayments = await serverGet<InitialData>('/admin/payments');

  return <AdminPaymentsClient initialPayments={initialPayments} />;
}
