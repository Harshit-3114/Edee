'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Tray } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import ApplicantTable from '@/components/college/ApplicantTable';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { APPLICATION_STATUS_LABEL } from '@/lib/format';
import type { ApplicationStatus, CollegeApplicant } from '@/lib/types';

const FILTERS: (ApplicationStatus | '')[] = [
  '',
  'payment_received',
  'under_review',
  'accepted',
  'rejected',
];

/**
 * The interactive half of this page.
 *
 * `initialApplicants` is the unfiltered list the server already fetched with the session
 * cookie - which is exactly what shows before anyone touches a filter. Null
 * means the server could not fetch, and this loads it on mount as before.
 */
export default function CollegeApplicationsClient({
  initialApplicants,
}: {
  initialApplicants: CollegeApplicant[] | null;
}) {
  const [applicants, setApplicants] = useState<CollegeApplicant[]>(initialApplicants ?? []);
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [loading, setLoading] = useState(initialApplicants === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CollegeApplicant[]>('/college/applications', {
        params: { status: status || undefined },
      });
      setApplicants(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load applications.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Skips exactly one run: the initial, unfiltered fetch the server already
  // did. Cleared immediately, so every later filter change still loads.
  const served = useRef(initialApplicants !== null);
  useEffect(() => {
    if (served.current) {
      served.current = false;
      return;
    }
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Applicants appear here once their fee is paid. Moving an application to accepted or rejected is final."
      />

      <div
        role="tablist"
        aria-label="Filter by status"
        className="mb-5 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5"
      >
        {FILTERS.map((value) => {
          const selected = status === value;
          return (
            <button
              key={value || 'all'}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStatus(value)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                selected
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {value ? APPLICATION_STATUS_LABEL[value] : 'All'}
            </button>
          );
        })}
      </div>

      {loading && <LoadingList rows={5} columns={5} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && applicants.length === 0 && (
        <EmptyState
          icon={<Tray size={26} />}
          title={status ? 'Nothing at this stage' : 'No applications yet'}
          body={
            status
              ? 'No applications are currently at this stage. Try another filter.'
              : 'Applications appear as soon as a student pays the fee for one of your courses.'
          }
        />
      )}

      {!loading && !error && applicants.length > 0 && (
        <ApplicantTable applicants={applicants} onChanged={() => void load()} />
      )}
    </>
  );
}

export type InitialData = CollegeApplicant[];
