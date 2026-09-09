/**
 * Label-and-value pairs for a detail page.
 *
 * A definition list rather than a table: these are attributes of one record,
 * not rows of comparable data, and screen readers announce the pairing.
 */
export function DetailList({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
  );
}

export function DetailItem({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-[var(--text-muted)]">{label}</dt>
      <dd className={`mt-1 text-sm break-words ${mono ? 'tabular' : ''}`}>{children}</dd>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
