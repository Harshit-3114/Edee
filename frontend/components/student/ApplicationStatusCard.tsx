import Badge from '@/components/ui/Badge';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  formatDate,
  formatFee,
} from '@/lib/format';
import type { Application } from '@/lib/types';

export default function ApplicationStatusCard({
  application,
}: {
  application: Application;
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium tracking-tight">
            {application.college_name}
          </h3>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {application.course_name} · {application.city}
          </p>
        </div>
        <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
          {APPLICATION_STATUS_LABEL[application.status]}
        </Badge>
      </header>

      {application.status_note && (
        <p className="mt-4 rounded-lg bg-[var(--surface-sunken)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {application.status_note}
        </p>
      )}

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
        <div>
          <dt className="text-[var(--text-muted)]">Fee paid</dt>
          <dd className="tabular mt-0.5 font-medium">{formatFee(application.amount)}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Applied</dt>
          <dd className="mt-0.5">{formatDate(application.created_at)}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Last update</dt>
          <dd className="mt-0.5">{formatDate(application.updated_at)}</dd>
        </div>
      </dl>
    </article>
  );
}
