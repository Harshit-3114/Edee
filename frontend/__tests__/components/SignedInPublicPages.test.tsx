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

// UserMenu reads the Firebase user for the avatar initial and the email line.
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => {};
  },
  signOut: vi.fn().mockResolvedValue(undefined),
}));

const { default: LandingBackLink } = await import('@/components/college/LandingBackLink');
const { default: SiteHeader } = await import('@/app/(public)/_components/SiteHeader');

function signedInAs(role: Role | null, loading = false) {
  roleState.role = role;
  roleState.loading = loading;
}

/**
 * Public pages sit outside every portal prefix. Nothing here clears a session,
 * but before this fix they gave a signed-in visitor no sign of one: the back
 * arrow dropped them on the marketing home page and the header offered them
 * "Sign in". That reads as being logged out.
 */
describe('public pages keep a signed-in visitor signed in', () => {
  it('sends a student back to their portal, not the marketing home page', () => {
    signedInAs('student');
    render(<LandingBackLink />);
    expect(screen.getByRole('link', { name: /find colleges/i })).toHaveAttribute(
      'href',
      '/student/colleges',
    );
  });

  it.each([
    ['college', '/college/dashboard'],
    ['coaching', '/coaching/dashboard'],
    ['admin', '/admin/colleges'],
  ] as const)('sends a %s user back into their own portal', (role, href) => {
    signedInAs(role);
    render(<LandingBackLink />);
    expect(screen.getByRole('link')).toHaveAttribute('href', href);
  });

  it('still sends a genuinely signed-out visitor home', () => {
    signedInAs(null);
    render(<LandingBackLink />);
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  });

  it('falls back to home while the role is still loading', () => {
    signedInAs('student', true);
    render(<LandingBackLink />);
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  });

  it('offers a signed-in student their portal instead of a sign-in button', () => {
    signedInAs('student');
    render(<SiteHeader />);
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /student portal/i })).toHaveAttribute(
      'href',
      '/student/dashboard',
    );
  });

  it('still offers sign-in to a signed-out visitor', () => {
    signedInAs(null);
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
