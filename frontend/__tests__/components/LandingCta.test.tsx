import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Role } from '@/lib/portals';

const roleState = vi.hoisted(() => ({
  role: null as Role | null,
  collegeId: null as string | null,
  coachingCentreId: null as string | null,
  loading: false,
}));

vi.mock('@/hooks/useRole', () => ({ useRole: () => roleState }));

const { default: LandingCta } = await import('@/components/college/LandingCta');

function signedInAs(role: Role | null, loading = false) {
  roleState.role = role;
  roleState.loading = loading;
}

describe('LandingCta', () => {
  it('offers a signed-out visitor an account', () => {
    signedInAs(null);
    render(<LandingCta />);
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('never offers an account to someone who already has one', () => {
    signedInAs('student');
    render(<LandingCta />);
    expect(screen.queryByRole('link', { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your portal/i })).toHaveAttribute(
      'href',
      '/student/dashboard',
    );
  });

  it.each([
    ['college', '/college/dashboard'],
    ['coaching', '/coaching/dashboard'],
    ['admin', '/admin/dashboard'],
  ] as const)('points a signed-in %s at their own portal', (role, href) => {
    signedInAs(role);
    render(<LandingCta />);
    expect(screen.queryByRole('link', { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your portal/i })).toHaveAttribute(
      'href',
      href,
    );
  });

  it('keeps the shortlist route in both states', () => {
    signedInAs(null);
    const { unmount } = render(<LandingCta />);
    expect(screen.getByRole('link', { name: /shortlist courses/i })).toBeInTheDocument();
    unmount();

    signedInAs('student');
    render(<LandingCta />);
    expect(screen.getByRole('link', { name: /shortlist courses/i })).toBeInTheDocument();
  });

  it('shows the signed-out CTA while the role is still resolving', () => {
    signedInAs('student', true);
    render(<LandingCta />);
    expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument();
  });
});
