export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral:
    'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--line-strong)]',
  info: 'bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info-line)]',
  success:
    'bg-[var(--accent-subtle)] text-[var(--accent-text)] border-[var(--accent-line)]',
  warning:
    'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning-line)]',
  danger: 'bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger-line)]',
};

/** Badges are the one pill-shaped thing in the product. Everything else is 8px. */
export default function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
