'use client';

import { MagnifyingGlass, X } from '@phosphor-icons/react';

export default function CollegeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <label htmlFor="college-search" className="sr-only">
        Search colleges by name
      </label>

      <MagnifyingGlass
        size={17}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
        aria-hidden="true"
      />

      <input
        id="college-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by college name"
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-raised)] pr-10 pl-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] [&::-webkit-search-cancel-button]:hidden"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <X size={14} weight="bold" />
          <span className="sr-only">Clear search</span>
        </button>
      )}
    </div>
  );
}
