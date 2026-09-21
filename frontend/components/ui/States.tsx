'use client';

import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react';
import Button from './Button';

/** Skeletons mirror the shape of what is loading, not a generic spinner. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <div className="mt-5 space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function RowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--line)] px-4 py-3.5">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} className="h-3.5 flex-1" />
      ))}
    </div>
  );
}

export function LoadingList({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]"
    >
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, index) => (
        <RowSkeleton key={index} columns={columns} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--line-strong)] px-6 py-14 text-center">
      {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
      <h3 className="text-base font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">
        {body}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-subtle)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <WarningCircle size={18} weight="fill" className="mt-px text-[var(--danger)]" />
        <p className="text-sm text-[var(--text-primary)]">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <ArrowClockwise size={14} weight="bold" />
          Try again
        </Button>
      )}
    </div>
  );
}
