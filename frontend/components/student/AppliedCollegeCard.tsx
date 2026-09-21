import { formatDate, formatFee } from '@/lib/format';
import type { Application } from '@/lib/types';

/**
 * One applied college on the student dashboard. Deliberately status-free:
 * the site is for shortlisting and applying, so this shows what was applied
 * for, what it cost, when, and by when - never the college's verdict.
 */
export default function AppliedCollegeCard({
  application,
}: {
  application: Application;
}) {
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]">
      <header>
        <h3 className="text-base font-medium tracking-tight">
          {application.college_name}
        </h3>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {application.course_name} · {application.city}
        </p>
      </header>

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
          <dt className="text-[var(--text-muted)]">Deadline</dt>
          <dd className="mt-0.5">
            {application.closing_date ? formatDate(application.closing_date) : 'No deadline'}
          </dd>
        </div>
      </dl>
    </article>
  );
}
