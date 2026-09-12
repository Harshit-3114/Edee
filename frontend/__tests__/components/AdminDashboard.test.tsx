import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const get = vi.fn();

vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const { default: AdminDashboardPage } = await import('@/app/admin/dashboard/page');

const summary = {
  students: 1240,
  colleges: 48,
  coaching_centres: 12,
  applications: 3410,
  revenue: 511500000,
};

const payments = [
  {
    id: 'pay-1',
    student_name: 'Ananya Deshmukh',
    razorpay_payment_id: 'pay_Q2test',
    amount: 150000,
    status: 'captured',
    verified_at: '2026-09-10T10:00:00Z',
  },
];

const events = [
  {
    id: 'evt-1',
    actor_role: 'college',
    action: 'application.accepted',
    entity_type: 'application',
    entity_id: 'app-1',
    created_at: '2026-09-10T11:00:00Z',
  },
];

function mockAll() {
  get.mockImplementation((url: unknown) => {
    if (url === '/admin/dashboard') return Promise.resolve({ data: summary });
    if (url === '/admin/payments') return Promise.resolve({ data: payments });
    if (url === '/admin/audit') return Promise.resolve({ data: events });
    return Promise.reject(new Error(`unexpected ${String(url)}`));
  });
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    get.mockReset();
    mockAll();
  });

  it('shows platform totals plus recent payments and activity', async () => {
    render(<AdminDashboardPage />);
    expect(await screen.findByText('1,240')).toBeInTheDocument();
    expect(screen.getByText('Ananya Deshmukh')).toBeInTheDocument();
    expect(screen.getByText(/pay_Q2test/)).toBeInTheDocument();
    expect(screen.getByText('application.accepted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /full ledger/i })).toHaveAttribute(
      'href',
      '/admin/payments',
    );
    expect(screen.getByRole('link', { name: /full audit trail/i })).toHaveAttribute(
      'href',
      '/admin/audit',
    );
  });

  it('says plainly when there is nothing to show yet', async () => {
    get.mockImplementation((url: unknown) => {
      if (url === '/admin/dashboard') return Promise.resolve({ data: summary });
      return Promise.resolve({ data: [] });
    });
    render(<AdminDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('No payments yet.')).toBeInTheDocument();
      expect(screen.getByText('No events yet.')).toBeInTheDocument();
    });
  });
});
