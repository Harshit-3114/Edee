/**
 * A single number with its label. Used on all four dashboards.
 *
 * No card chrome and no icon: a row of these is a set of readings, and the
 * dividing lines carry the grouping. Numbers are tabular so columns of them
 * line up on the decimal.
 */
export default function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="px-5 py-4">
      <dt className="text-[13px] text-[var(--text-secondary)]">{label}</dt>
      <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</dd>
      {note && <p className="mt-1 text-xs text-[var(--text-muted)]">{note}</p>}
    </div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 [&>*]:sm:border-r [&>*]:sm:border-[var(--line)] [&>*:last-child]:sm:border-r-0">
      {children}
    </dl>
  );
}
