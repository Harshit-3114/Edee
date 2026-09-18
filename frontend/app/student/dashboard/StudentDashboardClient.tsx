'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, FileText } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import ApplicationStatusCard from '@/components/student/ApplicationStatusCard';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { APPLICATION_STATUS_LABEL } from '@/lib/format';
import type { Application, ApplicationStatus } from '@/lib/types';

/**
 * The interactive half of the dashboard.
 *
 * `initialApplications` is whatever the server already fetched with the
 * session cookie. When it is there the list renders on the first paint with no
 * spinner and no round trip. When it is null - no session cookie yet, or one
 * that has lapsed - this falls back to fetching on mount, exactly as the page
 * behaved before server rendering existed.
 */
export default function StudentDashboardClient({
  initialApplications,
}: {
  initialApplications: Application[] | null;
}) {
  const params = useSearchParams();
  const justPaid = params.get('paid') === '1';

  const [applications, setApplications] = useState<Application[]>(initialApplications ?? []);
  const [loading, setLoading] = useState(initialApplications === null);
  const [error, setError] = useState('');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Application[]>('/students/me/applications');
      setApplications(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your applications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this whole change exists to remove.
  const served = useRef(initialApplications !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  const withdraw = useCallback(
    async (id: string) => {
      setWithdrawingId(id);
      try {
        await api.post(`/students/me/applications/${id}/withdraw`);
        await load();
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not withdraw that application.'));
      } finally {
        setWithdrawingId(null);
      }
    },
    [load],
  );

  const counts = useMemo(() => {
    const tally: Record<ApplicationStatus, number> = {
      payment_received: 0,
      under_review: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
    };
    for (const application of applications) tally[application.status] += 1;
    return tally;
  }, [applications]);

  return (
    <>
      <PageHeader
        title="Your applications"
        description="Colleges update these as they review. You will not need to pay again."
        action={
          applications.length > 0 ? (
            <LinkButton href="/student/colleges" variant="secondary" size="sm">Apply to more</LinkButton>
          ) : undefined
        }
      />

      {justPaid && (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-subtle)] px-4 py-3.5"
        >
          <CheckCircle
            size={18}
            weight="fill"
            className="mt-px text-[var(--accent-text)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-primary)]">
            Payment received. Your applications are with the colleges now.
          </p>
        </div>
      )}

      {loading && (
        <div className="grid gap-4" role="status" aria-live="polite">
          <span className="sr-only">Loading your applications</span>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && applications.length === 0 && (
        <EmptyState
          icon={<FileText size={26} />}
          title="No applications yet"
          body="Once you pay for a shortlisted course, the application appears here and you can follow its status."
          action={
            <LinkButton href="/student/colleges">Find colleges</LinkButton>
          }
        />
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="mb-5">
          <StatRow>
            <StatTile
              label={APPLICATION_STATUS_LABEL.payment_received}
              value={String(counts.payment_received)}
            />
            <StatTile
              label={APPLICATION_STATUS_LABEL.under_review}
              value={String(counts.under_review)}
            />
            <StatTile
              label={APPLICATION_STATUS_LABEL.accepted}
              value={String(counts.accepted)}
            />
            <StatTile
              label={APPLICATION_STATUS_LABEL.rejected}
              value={String(counts.rejected)}
            />
          </StatRow>
        </div>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="grid gap-4">
          {applications.map((application) => (
            <ApplicationStatusCard
              key={application.id}
              application={application}
              onWithdraw={(id) => void withdraw(id)}
              withdrawing={withdrawingId === application.id}
            />
          ))}
        </div>
      )}
    </>
  );
}
