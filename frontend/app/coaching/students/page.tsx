'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import CohortTable from '@/components/coaching/CohortTable';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { COHORT_STAGE_LABEL } from '@/lib/format';
import type { CohortStage, CohortStudent } from '@/lib/types';

const STAGES: (CohortStage | '')[] = ['', 'signed_up', 'shortlisted', 'paid', 'accepted'];

export default function CoachingStudentsPage() {
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [stage, setStage] = useState<CohortStage | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CohortStudent[]>('/coaching/students', {
        params: { stage: stage || undefined, search: search || undefined },
      });
      setStudents(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your students.'));
    } finally {
      setLoading(false);
    }
  }, [stage, search]);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <>
      <PageHeader
        title="My students"
        description="Students who signed up with one of your invite codes. This view is read-only: they manage their own shortlists and payments."
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="cohort-search" className="sr-only">
            Search by name or phone
          </label>
          <Input
            id="cohort-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or phone"
          />
        </div>

        <label htmlFor="cohort-stage" className="sr-only">
          Filter by stage
        </label>
        <Select
          id="cohort-stage"
          value={stage}
          onChange={(event) => setStage(event.target.value as CohortStage | '')}
          className="w-auto"
        >
          {STAGES.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? COHORT_STAGE_LABEL[value] : 'All stages'}
            </option>
          ))}
        </Select>
      </div>

      {loading && <LoadingList rows={5} columns={6} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && students.length === 0 && (
        <EmptyState
          icon={<Users size={26} />}
          title={search || stage ? 'No students match' : 'No students linked yet'}
          body={
            search || stage
              ? 'Try a different search, or widen the stage filter.'
              : 'Share an invite code with your batch. Students who sign up with it appear here.'
          }
        />
      )}

      {!loading && !error && students.length > 0 && <CohortTable students={students} />}
    </>
  );
}
