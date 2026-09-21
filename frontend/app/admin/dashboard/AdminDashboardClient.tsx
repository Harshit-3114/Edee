'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { Panel } from '@/components/ui/DetailList';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate, formatFee } from '@/lib/format';
import type { AuditEvent, PaymentRow } from '@/lib/types';

interface AdminSummary {
  students: number;
  colleges: number;
  coaching_centres: number;
  applications: number;
  revenue: number;
}

/**
 * The interactive half of the overview.
 *
 * All three panels are fetched together on the server, so `initial` is either
 * every one of them or none - the page never renders half filled.
 */
export default function AdminDashboardClient({
  initial,
}: {
  initial: InitialData | null;
}) {
  const [summary, setSummary] = useState<AdminSummary | null>(initial?.summary ?? null);
  const [payments, setPayments] = useState<PaymentRow[]>(initial?.payments ?? []);
  const [events, setEvents] = useState<AuditEvent[]>(initial?.events ?? []);
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, paymentsRes, eventsRes] = await Promise.all([
        api.get<AdminSummary>('/admin/dashboard'),
        api.get<PaymentRow[]>('/admin/payments', { params: { limit: 5 } }),
        api.get<AuditEvent[]>('/admin/audit', { params: { limit: 5 } }),
      ]);
      setSummary(summaryRes.data);
      setPayments(paymentsRes.data);
      setEvents(eventsRes.data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it.
  const served = useRef(initial !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Platform-wide totals. Revenue is fees collected and verified, not fees pending."
        action={
          <LinkButton href="/admin/payments" variant="secondary" size="sm">
            Payment ledger
          </LinkButton>
        }
      />

      {loading && <Skeleton className="h-28 w-full" />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && summary && (
        <>
          <StatRow>
            <StatTile label="Students" value={summary.students.toLocaleString('en-IN')} />
            <StatTile label="Colleges" value={String(summary.colleges)} />
            <StatTile
              label="Coaching centres"
              value={String(summary.coaching_centres)}
            />
            <StatTile
              label="Applications"
              value={summary.applications.toLocaleString('en-IN')}
            />
          </StatRow>

          <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
            <StatTile
              label="Fees collected"
              value={formatFee(summary.revenue)}
              note="Verified payments only"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel
              title="Latest payments"
              action={
                <LinkButton href="/admin/payments" variant="ghost" size="sm">
                  Full ledger
                </LinkButton>
              }
            >
              {payments.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No payments yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--line)]">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {payment.student_name}
                        </span>
                        <span className="tabular block text-xs text-[var(--text-muted)]">
                          {payment.razorpay_payment_id} · {payment.status}
                        </span>
                      </span>
                      <span className="tabular text-sm font-medium">
                        {formatFee(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent activity"
              action={
                <LinkButton href="/admin/audit" variant="ghost" size="sm">
                  Full audit trail
                </LinkButton>
              }
            >
              {events.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No events yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--line)]">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                    >
                      <span className="tabular text-sm font-medium">{event.action}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {event.actor_role ?? 'system'} · {formatDate(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export interface InitialData {
  summary: AdminSummary;
  payments: PaymentRow[];
  events: AuditEvent[];
}
