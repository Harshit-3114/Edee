'use client';

import { FunnelSimple } from '@phosphor-icons/react';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { CollegeQuery, CollegeType, Stream } from '@/lib/types';

/** Enough states to cover the Phase 1 seed data. Extend as colleges are added. */
export const STATES = [
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Delhi',
  'Gujarat',
  'Telangana',
  'West Bengal',
  'Uttar Pradesh',
  'Rajasthan',
  'Kerala',
] as const;

interface Props {
  value: CollegeQuery;
  onChange: (next: CollegeQuery) => void;
}

const STREAMS: { value: Stream | ''; label: string }[] = [
  { value: '', label: 'All levels' },
  { value: 'UG', label: 'UG' },
  { value: 'PG', label: 'PG' },
];

export default function CollegeFilters({ value, onChange }: Props) {
  const active = Boolean(value.stream || value.state || value.type);

  function set<K extends keyof CollegeQuery>(key: K, raw: string) {
    onChange({ ...value, [key]: (raw || undefined) as CollegeQuery[K] });
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-1 text-[13px] font-medium text-[var(--text-secondary)]">
          <FunnelSimple size={15} weight="bold" aria-hidden="true" />
          Filters
        </span>

        <div
          role="group"
          aria-label="Filter by level"
          className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5"
        >
          {STREAMS.map((option) => {
            const selected = (value.stream ?? '') === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                onClick={() => set('stream', option.value)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  selected
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label htmlFor="filter-state" className="sr-only">
          Filter by state
        </label>
        <Select
          id="filter-state"
          value={value.state ?? ''}
          onChange={(event) => set('state', event.target.value)}
          className="h-9 w-auto text-[13px]"
        >
          <option value="">All states</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>

        <label htmlFor="filter-type" className="sr-only">
          Filter by college type
        </label>
        <Select
          id="filter-type"
          value={value.type ?? ''}
          onChange={(event) => set('type', event.target.value as CollegeType)}
          className="h-9 w-auto text-[13px]"
        >
          <option value="">All types</option>
          <option value="government">Government</option>
          <option value="private">Private</option>
          <option value="deemed">Deemed</option>
        </Select>

        {active && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange({ search: value.search })}
            className="ml-auto"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
