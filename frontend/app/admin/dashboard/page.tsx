'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatFee } from '@/lib/format';

interface AdminSummary {
  students: number;
  colleges: number;
  coaching_centres: number;
  applications: number;
  revenue: number;
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AdminSummary>('/admin/dashboard');
      setSummary(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
        </>
      )}
    </>
  );
}
