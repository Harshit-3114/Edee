'use client';

import { forwardRef } from 'react';
import { CircleNotch } from '@phosphor-icons/react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/*
  Contrast is checked per variant, not left to chance:
  - primary   white text on emerald-800 (light) / near-black on emerald-400 (dark)
  - secondary primary text on the raised surface, with a visible border
  - ghost     primary text, border only on hover, never transparent-on-transparent
  - danger    white text on red-700 (light) / near-black on red-400 (dark)
*/
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)] border border-transparent',
  secondary:
    'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--line-strong)] hover:bg-[var(--surface-hover)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
  danger:
    'bg-[var(--danger)] text-[var(--text-inverse)] hover:opacity-90 border border-transparent',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, children, className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap',
        'transition-[background-color,color,transform] duration-150',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <CircleNotch size={15} weight="bold" className="animate-spin" />}
      {children}
    </button>
  );
});

export default Button;
