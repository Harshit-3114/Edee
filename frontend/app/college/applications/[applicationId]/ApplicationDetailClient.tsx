'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Tray } from '@phosphor-icons/react';
import StatusForm from '@/components/college/StatusForm';
import Badge from '@/components/ui/Badge';
import BackLink from '@/components/ui/BackLink';
import LinkButton from '@/components/ui/LinkButton';
import { DetailItem, DetailList, Panel } from '@/components/ui/DetailList';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  formatDate,
  formatFee,
  formatPhone,
} from '@/lib/format';
import type { CollegeApplicationDetail } from '@/lib/types';

/**
 * `initialApplication` is the record the server already fetched with the session cookie.
 * Null means it could not - no session, or the record is gone - and this loads
 * it on mount, showing its own not-found or error state as it always did.
 */
export default function ApplicationDetailClient({
  id,
  initialApplication,
}: {
  id: string;
  initialApplication?: CollegeApplicationDetail | null;
}) {
  const [application, setApplication] = useState<CollegeApplicationDetail | null>(initialApplication ?? null);
  const [loading, setLoading] = useState(!initialApplication);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CollegeApplicationDetail>(
        `/college/applications/${id}`,
      );
      setApplication(data);
      setError('');
    } catch (err) {
      // A 404 here means the application belongs to another college. Say it is
      // not found rather than that access was denied.
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) setMissing(true);
      else setError(apiErrorMessage(err, 'Could not load this application.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Only when the server could not supply it.
  const served = useRef(Boolean(initialApplication));
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading the application</span>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-40 w-full" />
        <Skeleton className="mt-4 h-56 w-full" />
      </div>
    );
  }

  if (missing) {
    return (
      <>
        <BackLink href="/college/applications" label="All applications" />
        <EmptyState
          icon={<Tray size={26} />}
          title="Application not found"
          body="It may have been withdrawn, or the link may point at an application that is not yours."
          action={
            <LinkButton href="/college/applications">Back to applications</LinkButton>
          }
        />
      </>
    );
  }

  if (error || !application) {
    return (
      <>
        <BackLink href="/college/applications" label="All applications" />
        <ErrorState message={error || 'Could not load this application.'} onRetry={() => void load()} />
      </>
    );
  }

  return (
    <>
      <BackLink href="/college/applications" label="All applications" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {application.student_name}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {application.course_name}
          </p>
        </div>
        <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
          {APPLICATION_STATUS_LABEL[application.status]}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Applicant">
          <DetailList>
            <DetailItem label="Name">{application.student_name}</DetailItem>
            <DetailItem label="Applying for">
              {application.stream === 'UG' ? 'Undergraduate' : 'Postgraduate'}
            </DetailItem>
            <DetailItem label="Email">
              <a
                href={`mailto:${application.student_email}`}
                className="underline underline-offset-4"
              >
                {application.student_email}
              </a>
            </DetailItem>
            <DetailItem label="Phone" mono>
              <a
                href={`tel:+91${application.student_phone}`}
                className="underline underline-offset-4"
              >
                {formatPhone(application.student_phone)}
              </a>
            </DetailItem>
          </DetailList>
        </Panel>

        <Panel title="Application">
          <DetailList>
            <DetailItem label="Course">{application.course_name}</DetailItem>
            <DetailItem label="Fee paid" mono>
              {formatFee(application.amount)}
            </DetailItem>
            <DetailItem label="Applied">{formatDate(application.created_at)}</DetailItem>
            <DetailItem label="Last updated">
              {formatDate(application.updated_at)}
            </DetailItem>
          </DetailList>

          {application.status_note && (
            <div className="mt-5">
              <p className="text-[13px] text-[var(--text-muted)]">Current note</p>
              <p className="mt-1.5 rounded-lg bg-[var(--surface-sunken)] px-3.5 py-2.5 text-sm leading-relaxed">
                {application.status_note}
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Change status">
          <StatusForm
            applicationId={application.id}
            status={application.status}
            onChanged={() => void load()}
          />
        </Panel>
      </div>
    </>
  );
}

export type InitialData = CollegeApplicationDetail;
