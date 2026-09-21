'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatFee } from '@/lib/format';

interface CoachingSummary {
  centre_name: string;
  signed_up: number;
  shortlisted: number;
  paid: number;
  accepted: number;
  /** Submitted leads from every bulk upload. */
  total_leads: number;
  /** Paise charged per lead. Zero means terms are not set yet. */
  amount_per_lead: number;
  /** Paise of payments and waivers extended. */
  credit_paise: number;
  /** Derived: leads x rate - credit, never below zero. */
  outstanding_amount: number;
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
        <>
          <StatRow>
            <StatTile label="Signed up" value={String(summary.signed_up)} />
            <StatTile label="Shortlisted a course" value={String(summary.shortlisted)} />
            <StatTile label="Paid and applied" value={String(summary.paid)} />
            <StatTile label="Accepted somewhere" value={String(summary.accepted)} />
          </StatRow>

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-medium tracking-tight">Outstanding amount</h2>
              <p className="tabular text-2xl font-semibold">
                {formatFee(summary.outstanding_amount)}
              </p>
            </div>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {summary.total_leads} submitted{' '}
              {summary.total_leads === 1 ? 'lead' : 'leads'}
              {summary.amount_per_lead > 0 ? (
                <>
                  {' '}× {formatFee(summary.amount_per_lead)} per lead
                  {summary.credit_paise > 0 && (
                    <> − {formatFee(summary.credit_paise)} credit</>
                  )}
                </>
              ) : (
                ' — per-lead terms are not set yet, so nothing is owed'
              )}
              . Every upload adds to this; credit extended by the platform is
              subtracted, never hidden.
            </p>
            <div className="mt-3">
              <LinkButton href="/coaching/uploads" variant="secondary" size="sm">
                Upload students
              </LinkButton>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export type InitialData = CoachingSummary;
