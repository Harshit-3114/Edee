import { serverGet } from '@/lib/serverApi';
import AdminDashboardClient, { type InitialData } from './AdminDashboardClient';
import type { AuditEvent, PaymentRow } from '@/lib/types';

interface AdminSummary {
  students: number;
  colleges: number;
  coaching_centres: number;
  applications: number;
  revenue: number;
}

/**
 * Three panels, three endpoints, fetched together on the server.
 *
 * All or nothing on purpose: a half-filled overview is harder to read than an
 * honest loading state, so if any one of them fails the client half loads all
 * three itself and shows its own error.
 */
export default async function Page() {
  const [summary, payments, events] = await Promise.all([
    serverGet<AdminSummary>('/admin/dashboard'),
    serverGet<PaymentRow[]>('/admin/payments?limit=5'),
    serverGet<AuditEvent[]>('/admin/audit?limit=5'),
  ]);

  const initial: InitialData | null =
    summary && payments && events ? { summary, payments, events } : null;

  return <AdminDashboardClient initial={initial} />;
}
