'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
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

/**
 * The interactive half of this page.
 *
 * `initialSummary` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function CoachingDashboardClient({
  initialSummary,
}: {
  initialSummary: CoachingSummary | null;
}) {
  const [summary, setSummary] = useState<CoachingSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(initialSummary === null);
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

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialSummary !== null);
  useEffect(() => {
    if (served.current) return;
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

export type InitialData = CoachingSummary;
