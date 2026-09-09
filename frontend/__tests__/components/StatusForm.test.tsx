import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const patch = vi.fn();

vi.mock('@/lib/api', () => ({
  default: { patch: (...args: unknown[]) => patch(...args) },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const { default: StatusForm } = await import('@/components/college/StatusForm');

describe('StatusForm', () => {
  beforeEach(() => {
    patch.mockReset().mockResolvedValue({});
  });

  it('says there is nothing to do once a decision is made', () => {
    render(<StatusForm applicationId="app-1" status="accepted" onChanged={vi.fn()} />);
    expect(screen.getByText(/nothing further to change/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers only the transitions allowed from the current status', () => {
    render(
      <StatusForm applicationId="app-1" status="payment_received" onChanged={vi.fn()} />,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Under review');
    expect(options).not.toContain('Accepted');
    expect(options).not.toContain('Withdrawn');
  });

  it('will not submit until a status is chosen', () => {
    render(
      <StatusForm applicationId="app-1" status="payment_received" onChanged={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /update status/i })).toBeDisabled();
  });

  it('sends a non-final move straight through, with the note', async () => {
    const onChanged = vi.fn();
    render(
      <StatusForm applicationId="app-1" status="payment_received" onChanged={onChanged} />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/move to/i), 'under_review');
    await userEvent.type(screen.getByLabelText(/note for the applicant/i), 'Docs pending');
    await userEvent.click(screen.getByRole('button', { name: /update status/i }));

    expect(patch).toHaveBeenCalledWith('/college/applications/app-1', {
      status: 'under_review',
      status_note: 'Docs pending',
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('asks twice before a decision that cannot be undone', async () => {
    render(<StatusForm applicationId="app-1" status="under_review" onChanged={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText(/move to/i), 'rejected');
    await userEvent.click(screen.getByRole('button', { name: /update status/i }));

    // First click warns rather than sending.
    expect(patch).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/final/i);

    await userEvent.click(screen.getByRole('button', { name: /yes, confirm/i }));
    expect(patch).toHaveBeenCalledWith('/college/applications/app-1', {
      status: 'rejected',
      status_note: null,
    });
  });

  it('lets the reviewer back out of a final decision', async () => {
    render(<StatusForm applicationId="app-1" status="under_review" onChanged={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText(/move to/i), 'accepted');
    await userEvent.click(screen.getByRole('button', { name: /update status/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /update status/i })).toBeInTheDocument();
  });

  it('reports a failed update instead of pretending it worked', async () => {
    patch.mockRejectedValue(new Error('boom'));
    const onChanged = vi.fn();
    render(
      <StatusForm applicationId="app-1" status="payment_received" onChanged={onChanged} />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/move to/i), 'under_review');
    await userEvent.click(screen.getByRole('button', { name: /update status/i }));

    expect(await screen.findByText(/could not update the application/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
