'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';

interface CoachingSummary {
  centre_name: string;
  signed_up: number;
  shortlisted: number;
  paid: number;
  accepted: number;
}

export default function CoachingDashboardPage() {
  const [summary, setSummary] = useState<CoachingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CoachingSummary>('/coaching/dashboard');
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
        title={summary?.centre_name ?? 'Overview'}
        description="How far your students have got. Each number counts students, not applications."
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/coaching/invite" variant="secondary" size="sm">
              Invite codes
            </LinkButton>
            <LinkButton href="/coaching/students" variant="secondary" size="sm">
              View cohort
            </LinkButton>
          </div>
        }
      />

      {loading && <Skeleton className="h-28 w-full" />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && summary && (
        <StatRow>
          <StatTile label="Signed up" value={String(summary.signed_up)} />
          <StatTile label="Shortlisted a course" value={String(summary.shortlisted)} />
          <StatTile label="Paid and applied" value={String(summary.paid)} />
          <StatTile label="Accepted somewhere" value={String(summary.accepted)} />
        </StatRow>
      )}
    </>
  );
}
