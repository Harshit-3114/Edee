/**
 * A table wrapper that scrolls horizontally inside its own container.
 *
 * Portal tables carry real data (applicants, payments, audit rows) and cannot
 * always shrink to a phone. They scroll sideways; the page body never does.
 */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full min-w-[42rem] border-collapse text-sm">{children}</table>;
}

export function Th({
  children,
  numeric = false,
}: {
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] ${
        numeric ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  numeric = false,
  className = '',
  colSpan,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-[var(--line)] px-4 py-3 align-middle ${
        numeric ? 'text-right tabular' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="transition-colors hover:bg-[var(--surface-hover)]">{children}</tr>;
}
