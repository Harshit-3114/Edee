'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookmarkSimple, CheckCircle, FileText } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import ApplicationStatusCard from '@/components/student/ApplicationStatusCard';
import LinkButton from '@/components/ui/LinkButton';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { APPLICATION_STATUS_LABEL, formatDate, formatFee } from '@/lib/format';
import type { Application, ApplicationStatus, ShortlistEntry } from '@/lib/types';

/**
 * The interactive half of the dashboard.
 *
 * `initialApplications` and `initialShortlist` are whatever the server already
 * fetched with the session cookie. When they are there the lists render on the
 * first paint with no spinner and no round trip. When either is null - no
 * session cookie yet, or one that has lapsed - this falls back to fetching on
 * mount, exactly as the page behaved before server rendering existed.
 */
export default function StudentDashboardClient({
  initialApplications,
  initialShortlist,
}: {
  initialApplications: Application[] | null;
  initialShortlist: ShortlistEntry[] | null;
}) {
  const params = useSearchParams();
  const justPaid = params.get('paid') === '1';
  const justSignedUp = params.get('welcome') === '1';
  const devPayment = params.get('dev') === '1';

  const [applications, setApplications] = useState<Application[]>(initialApplications ?? []);
  const [loading, setLoading] = useState(initialApplications === null);
  const [error, setError] = useState('');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const [shortlist, setShortlist] = useState<ShortlistEntry[]>(initialShortlist ?? []);
  const [shortlistLoading, setShortlistLoading] = useState(initialShortlist === null);

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

  const loadShortlist = useCallback(async () => {
    setShortlistLoading(true);
    try {
      const { data } = await api.get<ShortlistEntry[]>('/shortlists/');
      setShortlist(data);
    } catch {
      // The shortlist section degrades to empty rather than failing the
      // whole dashboard: applications are the primary content here, and the
      // shortlist page itself surfaces the real error with a retry.
      setShortlist([]);
    } finally {
      setShortlistLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this whole change exists to remove.
  const served = useRef(initialApplications !== null);
  const shortlistServed = useRef(initialShortlist !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);
  useEffect(() => {
    if (shortlistServed.current) return;
    void loadShortlist();
  }, [loadShortlist]);

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
            Payment successful. Your applications are with the colleges now.
            {devPayment &&
              ' (Dev mode is on so no actual payment took place but this is how it would look.)'}
          </p>
        </div>
      )}

      {justSignedUp && (
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
            Profile created. Shortlist the courses you want to apply to, then pay
            once for everything on the list.
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

      {!shortlistLoading && shortlist.length > 0 && (
        <section aria-labelledby="shortlisted-heading" className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="shortlisted-heading" className="text-base font-medium tracking-tight">
              Shortlisted — pay to apply
            </h2>
            <LinkButton href="/student/shortlist" variant="ghost" size="sm">
              Manage shortlist
            </LinkButton>
          </div>
          <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]">
            {shortlist.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <BookmarkSimple size={15} aria-hidden="true" />
                    {entry.college_name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                    {entry.course_name} · {entry.city},{' '}
                    {entry.closing_date
                      ? `deadline ${formatDate(entry.closing_date)}`
                      : 'no deadline'}
                  </p>
                </div>
                <span className="tabular text-sm whitespace-nowrap">
                  {formatFee(entry.application_fee)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <LinkButton href="/student/checkout">Proceed to payment</LinkButton>
          </div>
        </section>
      )}
    </>
  );
}
