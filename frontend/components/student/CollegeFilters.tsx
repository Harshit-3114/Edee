'use client';

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

export default function CollegeFilters({ value, onChange }: Props) {
  const active = Boolean(value.stream || value.state || value.type);

  function set<K extends keyof CollegeQuery>(key: K, raw: string) {
    onChange({ ...value, [key]: (raw || undefined) as CollegeQuery[K] });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="filter-stream" className="sr-only">
        Filter by stream
      </label>
      <Select
        id="filter-stream"
        value={value.stream ?? ''}
        onChange={(event) => set('stream', event.target.value as Stream)}
        className="h-9 w-auto text-[13px]"
      >
        <option value="">All streams</option>
        <option value="UG">Undergraduate</option>
        <option value="PG">Postgraduate</option>
      </Select>

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
          variant="ghost"
          size="sm"
          onClick={() => onChange({ search: value.search })}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
