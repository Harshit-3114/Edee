'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatFee } from '@/lib/format';

interface CollegeSummary {
  college_name: string;
  applications_total: number;
  applications_under_review: number;
  seats_filled: number;
  seats_total: number;
  fees_collected: number;
}

export default function CollegeDashboardPage() {
  const [summary, setSummary] = useState<CollegeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CollegeSummary>('/college/dashboard');
      setSummary(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your overview.'));
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
        title={summary?.college_name ?? 'Overview'}
        description="Everything here is scoped to your college."
        action={
          <LinkButton href="/college/applications" variant="secondary" size="sm">
            Review applications
          </LinkButton>
        }
      />

      {loading && <Skeleton className="h-28 w-full" />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && summary && (
        <StatRow>
          <StatTile
            label="Applications"
            value={String(summary.applications_total)}
            note={`${summary.applications_under_review} awaiting review`}
          />
          <StatTile
            label="Seats filled"
            value={`${summary.seats_filled} of ${summary.seats_total}`}
          />
          <StatTile label="Fees collected" value={formatFee(summary.fees_collected)} />
          <StatTile
            label="Acceptance rate"
            value={
              summary.applications_total === 0
                ? '-'
                : `${Math.round((summary.seats_filled / summary.applications_total) * 100)}%`
            }
          />
        </StatRow>
      )}
    </>
  );
}
