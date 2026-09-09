import Link from 'next/link';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

/*
  A link that looks like a button.

  Deliberately separate from Button rather than a polymorphic `as` prop: a
  button nested inside an anchor (or the reverse) is invalid HTML and breaks
  keyboard navigation. If it navigates, it is an anchor.
*/
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)] border border-transparent',
  secondary:
    'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--line-strong)] hover:bg-[var(--surface-hover)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
};

export default function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap',
        'transition-[background-color,color,transform] duration-150 active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
