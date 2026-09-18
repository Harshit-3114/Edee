import Badge, { type Tone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  formatDate,
  formatFee,
} from '@/lib/format';
import type { Application } from '@/lib/types';

/** Left-edge stripe mirrors the status pill so state reads at a glance. */
const TONE_EDGE: Record<Tone, string> = {
  neutral: 'border-l-[var(--line-strong)]',
  success: 'border-l-[var(--success)]',
  warning: 'border-l-[var(--warning-solid)]',
  action: 'border-l-[var(--action-solid)]',
  danger: 'border-l-[var(--danger)]',
};

/** A student may withdraw only while a college has not yet decided. */
function canWithdraw(status: Application['status']): boolean {
  return status === 'payment_received' || status === 'under_review';
}

export default function ApplicationStatusCard({
  application,
  onWithdraw,
  withdrawing,
}: {
  application: Application;
  onWithdraw?: (id: string) => void;
  withdrawing?: boolean;
}) {
  const tone = APPLICATION_STATUS_TONE[application.status];
  return (
    <article
      className={`rounded-xl border border-[var(--line)] border-l-4 bg-[var(--surface-raised)] p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-sm)] ${TONE_EDGE[tone]}`}
    >
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

      {onWithdraw && canWithdraw(application.status) && (
        <div className="mt-4 flex justify-end border-t border-[var(--line)] pt-4">
          <Button
            variant="secondary"
            size="sm"
            loading={withdrawing}
            onClick={() => onWithdraw(application.id)}
          >
            Withdraw application
          </Button>
        </div>
      )}
    </article>
  );
}
