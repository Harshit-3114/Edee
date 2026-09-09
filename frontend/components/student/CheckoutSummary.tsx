import { formatFee, pluralise } from '@/lib/format';
import type { ShortlistEntry } from '@/lib/types';

export default function CheckoutSummary({
  entries,
  total,
}: {
  entries: ShortlistEntry[];
  total: number;
}) {
  return (
    <section
      aria-labelledby="order-summary"
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]"
    >
      <h2
        id="order-summary"
        className="border-b border-[var(--line)] px-5 py-3.5 text-sm font-medium"
      >
        {pluralise(entries.length, 'application', 'applications')}
      </h2>

      <ul className="px-5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-3.5 last:border-b-0"
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

      <div className="flex items-center justify-between border-t border-[var(--line-strong)] px-5 py-4">
        <span className="text-sm font-medium">Total payable</span>
        <span className="tabular text-lg font-semibold">{formatFee(total)}</span>
      </div>
    </section>
  );
}
