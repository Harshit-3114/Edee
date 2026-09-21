import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const search = vi.hoisted(() => ({ params: new URLSearchParams('') }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => search.params,
}));

const get = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  default: { get },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const { default: StudentDashboardClient } = await import(
  '@/app/student/dashboard/StudentDashboardClient'
);
import type { Application, ShortlistEntry } from '@/lib/types';

const applications: Application[] = [
  {
    id: 'app-1',
    college_id: 'col-1',
    course_id: 'crs-1',
    college_name: 'Fergusson College',
    course_name: 'B.Sc Statistics',
    city: 'Pune',
    status: 'under_review',
    status_note: null,
    amount: 150000,
    closing_date: '2027-03-31T12:00:00+00:00',
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
  },
];

const shortlist: ShortlistEntry[] = [
  {
    id: 'sl-1',
    college_id: 'col-2',
    course_id: 'crs-2',
    college_name: 'Christ University',
    course_name: 'BBA',
    city: 'Bengaluru',
    state: 'Karnataka',
  stream: 'UG',
  application_fee: 200000,
  application_start_date: null,
  intake_info: null,
  closing_date: '2027-04-30T12:00:00+00:00',
    created_at: '2026-09-12T10:00:00Z',
  },
];

function setup(query = '') {
  search.params = new URLSearchParams(query);
  render(
    <StudentDashboardClient initialApplications={applications} initialShortlist={shortlist} />,
  );
}

describe('StudentDashboard', () => {
  it('shows the deadline on each application card', () => {
    setup();
    expect(screen.getByText('Deadline')).toBeInTheDocument();
    expect(screen.getByText('31 Mar 2027')).toBeInTheDocument();
  });

  it('shows a shortlisted section with fees, deadlines, and a payment link', () => {
    setup();
    expect(screen.getByRole('heading', { name: /shortlisted/i })).toBeInTheDocument();
    expect(screen.getByText('Christ University')).toBeInTheDocument();
    expect(screen.getByText(/deadline 30 Apr 2027/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /proceed to payment/i }),
    ).toHaveAttribute('href', '/student/checkout');
  });

  it('confirms a fresh signup with a welcome message', () => {
    setup('welcome=1');
    expect(screen.getByText(/profile created/i)).toBeInTheDocument();
  });

  it('keeps the payment confirmation for returning checkouts', () => {
    setup('paid=1');
    expect(screen.getByText(/your applications are with the colleges now/i)).toBeInTheDocument();
  });

  it('says no money moved on a dev-mode payment', () => {
    setup('paid=1&dev=1');
    expect(screen.getByText(/no actual payment took place/i)).toBeInTheDocument();
  });
});
