export type Tone = 'neutral' | 'success' | 'warning' | 'action' | 'danger';

/** Status pills are vivid solids: white text on full-strength color. */
const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--text-secondary)] text-white border-transparent',
  success: 'bg-[var(--success)] text-white border-transparent',
  warning: 'bg-[var(--warning-solid)] text-white border-transparent',
  action: 'bg-[var(--action-solid)] text-white border-transparent',
  danger: 'bg-[var(--danger)] text-white border-transparent',
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
