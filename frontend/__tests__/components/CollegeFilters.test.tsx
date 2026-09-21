import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollegeFilters from '@/components/student/CollegeFilters';

describe('CollegeFilters', () => {
  it('reports a chosen stream to the parent', async () => {
    const onChange = vi.fn();
    render(<CollegeFilters value={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'PG' }));
    expect(onChange).toHaveBeenCalledWith({ stream: 'PG' });
  });

  it('clears a filter back to undefined rather than an empty string', async () => {
    const onChange = vi.fn();
    render(<CollegeFilters value={{ stream: 'UG' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'All levels' }));
    // An empty string would be sent as a query param and match nothing.
    expect(onChange).toHaveBeenCalledWith({ stream: undefined });
  });

  it('offers a reset only once something is filtered', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CollegeFilters value={{}} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

    rerender(<CollegeFilters value={{ state: 'Kerala', search: 'inst' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    // Clearing filters keeps the text query - the user did not ask to lose it.
    expect(onChange).toHaveBeenCalledWith({ search: 'inst' });
  });
});
