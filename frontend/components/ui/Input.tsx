'use client';

import { forwardRef } from 'react';

/*
  Placeholder colour is --text-muted, which clears WCAG AA against both
  --surface-raised and --surface. Do not lighten it: a placeholder that fails
  contrast is invisible to the people most likely to need the hint.
*/
const BASE =
  'h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors disabled:opacity-55 aria-[invalid=true]:border-[var(--danger)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${BASE} ${className}`} {...props} />;
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={`${BASE} cursor-pointer pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${BASE} h-auto min-h-20 py-2 leading-relaxed ${className}`}
      {...props}
    />
  );
});

export default Input;
