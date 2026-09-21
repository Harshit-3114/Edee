'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { UserCircle } from '@phosphor-icons/react';
import Badge, { type Tone } from '@/components/ui/Badge';
import BackLink from '@/components/ui/BackLink';
import LinkButton from '@/components/ui/LinkButton';
import { DetailItem, DetailList, Panel } from '@/components/ui/DetailList';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  COHORT_STAGE_LABEL,
  formatDate,
  formatFee,
  formatPhone,
  pluralise,
} from '@/lib/format';
import type { CohortStage, CohortStudentDetail } from '@/lib/types';

const STAGE_TONE: Record<CohortStage, Tone> = {
  signed_up: 'neutral',
  shortlisted: 'success',
  paid: 'warning',
  accepted: 'success',
};

/**
 * Read-only, deliberately.
 *
 * A coaching centre can see how far its students have got. It cannot edit a
 * profile, change a shortlist, or pay on anyone's behalf, so this page has no
 * form and no action buttons. If a request arrives to add one, it is a product
 * decision, not a UI gap.
 */
/**
 * `initialStudent` is the record the server already fetched with the session cookie.
 * Null means it could not - no session, or the record is gone - and this loads
 * it on mount, showing its own not-found or error state as it always did.
 */
export default function StudentDetailClient({
  id,
  initialStudent,
}: {
  id: string;
  initialStudent?: CohortStudentDetail | null;
}) {
  const [student, setStudent] = useState<CohortStudentDetail | null>(initialStudent ?? null);
  const [loading, setLoading] = useState(!initialStudent);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CohortStudentDetail>(`/coaching/students/${id}`);
      setStudent(data);
      setError('');
    } catch (err) {
      // The API answers 404 for a student who is not linked to this centre, so
      // that a centre cannot learn that an unrelated student exists.
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) setMissing(true);
      else setError(apiErrorMessage(err, 'Could not load this student.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Only when the server could not supply it.
  const served = useRef(Boolean(initialStudent));
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading the student</span>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-6 h-36 w-full" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    );
  }

  if (missing) {
    return (
      <>
        <BackLink href="/coaching/students" label="My students" />
        <EmptyState
          icon={<UserCircle size={26} />}
          title="Student not found"
          body="No student with this link is connected to your centre. They may have signed up without one of your invite codes."
          action={<LinkButton href="/coaching/students">Back to my students</LinkButton>}
        />
      </>
    );
  }

  if (error || !student) {
    return (
      <>
        <BackLink href="/coaching/students" label="My students" />
        <ErrorState
          message={error || 'Could not load this student.'}
          onRetry={() => void load()}
        />
      </>
    );
  }

  const unpaid = student.shortlist.filter(
    (entry) =>
      !student.applications.some((application) => application.course_id === entry.course_id),
  );

  return (
    <>
      <BackLink href="/coaching/students" label="My students" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{student.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Joined {formatDate(student.joined_at)}
          </p>
        </div>
        <Badge tone={STAGE_TONE[student.stage]}>
          {COHORT_STAGE_LABEL[student.stage]}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Contact">
          <DetailList>
            <DetailItem label="Email">
              <a
                href={`mailto:${student.email}`}
                className="underline underline-offset-4"
              >
                {student.email}
              </a>
            </DetailItem>
            <DetailItem label="Phone" mono>
              <a href={`tel:+91${student.phone}`} className="underline underline-offset-4">
                {formatPhone(student.phone)}
              </a>
            </DetailItem>
            <DetailItem label="Applying for">
              {student.stream === 'UG' ? 'Undergraduate' : 'Postgraduate'}
            </DetailItem>
            <DetailItem label="Progress">
              {pluralise(student.shortlist_count, 'shortlisted', 'shortlisted')},{' '}
              {pluralise(student.application_count, 'applied', 'applied')}
            </DetailItem>
          </DetailList>
        </Panel>

        <Panel title="Applications">
          {student.applications.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nothing submitted yet. Applications appear once the fee is paid.
            </p>
          ) : (
            <ul className="flex flex-col">
              {student.applications.map((application) => (
                <li
                  key={application.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{application.college_name}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                      {application.course_name} · {formatFee(application.amount)}
                    </p>
                  </div>
                  <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
                    {APPLICATION_STATUS_LABEL[application.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Shortlisted, not yet paid">
          {unpaid.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nothing waiting. Everything shortlisted has been paid for.
            </p>
          ) : (
            <ul className="flex flex-col">
              {unpaid.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.college_name}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                      {entry.course_name} · {entry.city}
                    </p>
                  </div>
                  <span className="tabular text-sm whitespace-nowrap">
                    {formatFee(entry.application_fee)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export type InitialData = CohortStudentDetail;
