import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Role } from '@/lib/portals';

const roleState = vi.hoisted(() => ({
  role: null as Role | null,
  collegeId: null as string | null,
  coachingCentreId: null as string | null,
  loading: false,
}));

const firebaseUser = vi.hoisted(() => ({
  current: null as { email: string | null } | null,
}));

vi.mock('@/hooks/useRole', () => ({ useRole: () => roleState }));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb(firebaseUser.current);
    return () => {};
  },
  signOut: vi.fn().mockResolvedValue(undefined),
}));

const { default: UserMenu } = await import('@/components/shells/UserMenu');

function signedInAs(role: Role | null, email: string | null = 'ananya@mail.com', loading = false) {
  roleState.role = role;
  roleState.loading = loading;
  firebaseUser.current = email === null && role === null ? null : { email };
}

describe('UserMenu', () => {
  it('shows nothing at all to a signed-out visitor', () => {
    signedInAs(null, null);
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing while the role is still resolving', () => {
    signedInAs('student', 'ananya@mail.com', true);
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on click and names the account', async () => {
    signedInAs('student');
    render(<UserMenu />);

    const button = screen.getByRole('button', { name: /your account/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('ananya@mail.com')).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it.each([
    ['student', '/student/profile'],
    ['college', '/college/profile'],
    ['coaching', '/coaching/profile'],
    ['admin', '/admin/profile'],
  ] as const)('points a %s at their own profile page', async (role, href) => {
    signedInAs(role);
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button', { name: /your account/i }));
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', href);
  });

  it('carries no sign-out: the portal shell owns that button', async () => {
    signedInAs('student');
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button', { name: /your account/i }));
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
  });

  it('falls back to the role initial when a dev session has no email', async () => {
    signedInAs('admin', null);
    render(<UserMenu />);
    const button = screen.getByRole('button', { name: /your account/i });
    expect(button).toHaveTextContent('A');
    await userEvent.click(button);
    expect(screen.getByText('Admin account')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    signedInAs('student');
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button', { name: /your account/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
