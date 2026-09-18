import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '@/components/ui/Badge';
import { APPLICATION_STATUS_TONE } from '@/lib/format';

describe('Badge', () => {
  it('renders the orange action-required tone as a pill', () => {
    render(<Badge tone="action">Payment pending</Badge>);
    const el = screen.getByText('Payment pending');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('var(--action-solid)');
  });

  it('maps payment_received to the success tone, not info-blue', () => {
    expect(APPLICATION_STATUS_TONE.payment_received).toBe('success');
  });
});
