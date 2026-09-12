'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, FileText } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import ApplicationStatusCard from '@/components/student/ApplicationStatusCard';
import LinkButton from '@/components/ui/LinkButton';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import type { Application } from '@/lib/types';

export default function StudentDashboardPage() {
  const params = useSearchParams();
  const justPaid = params.get('paid') === '1';

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
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
