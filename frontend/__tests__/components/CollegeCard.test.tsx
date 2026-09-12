import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollegeCard from '@/components/student/CollegeCard';
import type { College } from '@/lib/types';

const college: College = {
  id: 'col-1',
  name: 'Veermata Jijabai Technological Institute',
  location: 'Matunga, Mumbai',
  city: 'Mumbai',
  state: 'Maharashtra',
  type: 'government',
  active: true,
  courses: [
    {
      id: 'crs-1',
      college_id: 'col-1',
      course_name: 'B.Tech Computer Engineering',
      stream: 'UG',
      duration_years: 4,
      seats: 120,
      application_fee: 150000,
      closing_date: null,
      active: true,
    },
    {
      id: 'crs-2',
      college_id: 'col-1',
      course_name: 'B.Tech Civil Engineering',
      stream: 'UG',
      duration_years: 4,
      seats: 60,
      application_fee: 120000,
      closing_date: null,
      active: false,
    },
  ],
};

function setup(overrides: Partial<Parameters<typeof CollegeCard>[0]> = {}) {
  const onToggle = vi.fn();
  render(
    <CollegeCard
      college={college}
      isShortlisted={() => false}
      isPending={() => false}
      onToggle={onToggle}
      {...overrides}
    />,
  );
  return { onToggle };
}

describe('CollegeCard', () => {
  it('shows the college, its location, and its fees in rupees', () => {
    setup();
    expect(screen.getByRole('heading', { name: college.name })).toBeInTheDocument();
    expect(screen.getByText(/Mumbai, Maharashtra/)).toBeInTheDocument();
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it('hides courses that are not open for applications', () => {
    setup();
    expect(screen.getByText('B.Tech Computer Engineering')).toBeInTheDocument();
    expect(screen.queryByText('B.Tech Civil Engineering')).not.toBeInTheDocument();
  });

  it('passes the college and course ids up when shortlisting', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByRole('button', { name: /add .* to shortlist/i }));
    expect(onToggle).toHaveBeenCalledWith('col-1', 'crs-1');
  });

  it('reports its state to assistive tech when already shortlisted', () => {
    setup({ isShortlisted: () => true });
    const button = screen.getByRole('button', { name: /remove .* from shortlist/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables the button while the request is in flight', () => {
    setup({ isPending: () => true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('says so plainly when a college has nothing open', () => {
    render(
      <CollegeCard
        college={{ ...college, courses: [] }}
        isShortlisted={() => false}
        isPending={() => false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText(/no courses are open/i)).toBeInTheDocument();
  });

  it('links to the public landing page when the listing carries a slug', () => {
    setup({ college: { ...college, slug: 'fergusson-college' } });
    expect(
      screen.getByRole('link', { name: /public landing page/i }),
    ).toHaveAttribute('href', '/colleges/fergusson-college');
  });

  it('shows no landing link when the listing has no slug', () => {
    setup();
    expect(screen.queryByRole('link', { name: /public landing page/i })).not.toBeInTheDocument();
  });
});
