import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const get = vi.fn();

vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const { default: AdminApisPage } = await import('@/app/admin/apis/page');

const mixed = {
  overall: 'down',
  checked_at: '2026-09-12T10:00:00Z',
  services: [
    { name: 'api', label: 'API', status: 'operational', latency_ms: null, detail: 'Responding' },
    {
      name: 'database',
      label: 'PostgreSQL',
      status: 'operational',
      latency_ms: 3,
      detail: 'SELECT 1 ok',
    },
    {
      name: 'razorpay',
      label: 'Razorpay',
      status: 'down',
      latency_ms: null,
      detail: 'Unreachable or invalid credentials',
    },
  ],
};

describe('AdminApisPage', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: mixed });
  });

  it('shows every integration with its own verdict', async () => {
    render(<AdminApisPage />);
    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('SELECT 1 ok')).toBeInTheDocument();
    expect(screen.getByText('Responded in 3 ms')).toBeInTheDocument();
    expect(screen.getAllByText('No round trip measured')).toHaveLength(2);
    // Worst part wins the headline: the banner and the failing service agree.
    expect(screen.getAllByText('Down')).toHaveLength(2);
  });

  it('refresh reruns the checks without flashing a skeleton', async () => {
    render(<AdminApisPage />);
    await screen.findByText('PostgreSQL');
    get.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/admin/system');
    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
  });
});
