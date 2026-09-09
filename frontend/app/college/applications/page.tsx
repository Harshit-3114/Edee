'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tray } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import ApplicantTable from '@/components/college/ApplicantTable';
import { Select } from '@/components/ui/Input';
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

export default function CollegeApplicationsPage() {
  const [applicants, setApplicants] = useState<CollegeApplicant[]>([]);
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Applicants appear here once their fee is paid. Moving an application to accepted or rejected is final."
      />

      <div className="mb-5">
        <label htmlFor="filter-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="filter-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}
          className="h-9 w-auto text-[13px]"
        >
          {FILTERS.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? APPLICATION_STATUS_LABEL[value] : 'All applications'}
            </option>
          ))}
        </Select>
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
