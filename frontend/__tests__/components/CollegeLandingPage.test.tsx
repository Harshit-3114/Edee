import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CollegeLandingPage from '@/components/college/CollegeLandingPage';
import type { CollegeLanding } from '@/lib/types';

// useRole (via the header / back link) subscribes to the Firebase token.
// These tests render the page as a signed-out visitor.
vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => {};
  },
}));

const landing: CollegeLanding = {
  id: 'col-1',
  name: 'Fergusson College',
  slug: 'fergusson-college',
  location: 'FC Road',
  city: 'Pune',
  state: 'Maharashtra',
  type: 'private',
  landing_hero_image_url: 'https://img.example/hero.jpg',
  landing_description: 'A great place to study.',
  landing_gallery_urls: ['https://img.example/1.jpg', 'https://img.example/2.jpg'],
  application_phases: 'Phase 1: Jun-Jul; Phase 2: Aug.',
  logo_url: null,
  courses: [
    {
      id: 'crs-1',
      college_id: 'col-1',
      course_name: 'B.Sc Statistics',
      stream: 'UG',
      duration_years: 3,
      seats: 60,
      application_fee: 150000,
      application_start_date: null,
      intake_info: null,
      closing_date: null,
      active: true,
    },
    {
      id: 'crs-2',
      college_id: 'col-1',
      course_name: 'M.Sc Statistics',
      stream: 'PG',
      duration_years: 2,
      seats: 20,
      application_fee: 200000,
      application_start_date: null,
      intake_info: null,
      closing_date: null,
      active: false,
    },
  ],
};

describe('CollegeLandingPage', () => {
  it('shows the public listing without asking for anything personal', () => {
    const { container } = render(<CollegeLandingPage college={landing} />);
    expect(screen.getByRole('heading', { name: 'Fergusson College' })).toBeInTheDocument();
    expect(screen.getByText('A great place to study.')).toBeInTheDocument();
    // Fee in rupees, not paise (stats strip and course table agree).
    expect(screen.getAllByText(/1,500/).length).toBeGreaterThan(0);
    // Only open courses are listed.
    expect(screen.getByText('B.Sc Statistics')).toBeInTheDocument();
    expect(screen.queryByText('M.Sc Statistics')).not.toBeInTheDocument();
    // Gallery images carry accessible names.
    expect(screen.getAllByAltText(/campus photo/)).toHaveLength(2);
    // No email, phone, or applicant data anywhere on a public page.
    expect(container.textContent).not.toMatch(/@|phone/i);
  });

  it('renders without landing content rather than crashing', () => {
    render(
      <CollegeLandingPage
        college={{
          ...landing,
          landing_hero_image_url: null,
          landing_description: null,
          landing_gallery_urls: null,
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Fergusson College' })).toBeInTheDocument();
    expect(screen.queryByAltText(/campus photo/)).not.toBeInTheDocument();
  });

  it('points visitors at the student portal instead of a dead end', () => {
    render(<CollegeLandingPage college={landing} />);
    expect(screen.getByRole('link', { name: /shortlist courses/i })).toHaveAttribute(
      'href',
      '/student/colleges',
    );
  });
});
