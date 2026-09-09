import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckoutSummary from '@/components/student/CheckoutSummary';
import { sumFees } from '@/lib/format';
import type { ShortlistEntry } from '@/lib/types';

const entries: ShortlistEntry[] = [
  {
    id: 'sl-1',
    college_id: 'col-1',
    course_id: 'crs-1',
    college_name: 'Fergusson College',
    course_name: 'B.Sc Statistics',
    city: 'Pune',
    state: 'Maharashtra',
    stream: 'UG',
    application_fee: 90000,
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'sl-2',
    college_id: 'col-2',
    course_id: 'crs-2',
    college_name: 'St. Xavier’s College',
    course_name: 'B.A Economics',
    city: 'Mumbai',
    state: 'Maharashtra',
    stream: 'UG',
    application_fee: 125000,
    created_at: '2026-06-02T10:00:00Z',
  },
];

describe('CheckoutSummary', () => {
  it('lists every application being paid for', () => {
    render(<CheckoutSummary entries={entries} total={sumFees(entries.map((e) => e.application_fee))} />);
    expect(screen.getByText('Fergusson College')).toBeInTheDocument();
    expect(screen.getByText('St. Xavier’s College')).toBeInTheDocument();
    expect(screen.getByText('2 applications')).toBeInTheDocument();
  });

  it('shows a total that matches the sum of the lines', () => {
    // 90000 + 125000 paise = 2,150 rupees. The number on this screen is the
    // number the student is charged, so it gets its own assertion.
    render(<CheckoutSummary entries={entries} total={215000} />);
    expect(screen.getByText(/2,150/)).toBeInTheDocument();
  });

  it('uses the singular for one application', () => {
    render(<CheckoutSummary entries={[entries[0]]} total={90000} />);
    expect(screen.getByText('1 application')).toBeInTheDocument();
  });
});
