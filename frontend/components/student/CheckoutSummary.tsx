import { formatFee, pluralise } from '@/lib/format';
import type { OrderQuote, ShortlistEntry } from '@/lib/types';

export default function CheckoutSummary({
  entries,
  total,
  quote = null,
}: {
  entries: ShortlistEntry[];
  total: number;
  /** Server-priced preview. Absent until fetched, or when it fails. */
  quote?: OrderQuote | null;
}) {
  return (
    <section
      aria-labelledby="order-summary"
      className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]"
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

      <div className="border-t border-[var(--line-strong)] px-5 py-4">
        {quote && quote.discount_amount > 0 ? (
          <dl className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
              <dt>Total ({pluralise(quote.item_count, 'application', 'applications')})</dt>
              <dd className="tabular line-through">{formatFee(quote.total_amount)}</dd>
            </div>
            <div className="flex items-center justify-between text-sm text-[var(--accent-text)]">
              <dt>Scholarship · {quote.item_count} forms</dt>
              <dd className="tabular font-medium">−{formatFee(quote.discount_amount)}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <dt className="text-sm font-medium">You pay</dt>
              <dd className="tabular text-lg font-semibold">{formatFee(quote.amount)}</dd>
            </div>
          </dl>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total payable</span>
            <span className="tabular text-lg font-semibold">{formatFee(total)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
