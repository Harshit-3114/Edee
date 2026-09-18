import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/login',
}));

vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: class {
    clear() {}
  },
  signInWithPhoneNumber: vi.fn(),
  signInWithPopup: vi.fn(),
  onAuthStateChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => {};
  },
  onIdTokenChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => {};
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('@/components/auth/DevSignIn', () => ({
  default: () => null,
  useDevBypass: () => false,
}));

const { default: LoginClient } = await import('@/app/(public)/login/LoginClient');

describe('LoginClient portal picker', () => {
  it('offers all four portals with Student selected by default', () => {
    render(<LoginClient />);
    const group = screen.getByRole('group', { name: /choose your portal/i });
    expect(group).toBeInTheDocument();
    for (const name of ['Student', 'College', 'Coaching', 'Admin']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /student/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /college/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches portal via the URL and shows portal-specific guidance', async () => {
    render(<LoginClient />);
    await userEvent.click(screen.getByRole('button', { name: /college/i }));
    expect(replace).toHaveBeenCalledWith('/login?portal=college');
    // The guidance text for college portal
    expect(screen.getByText(/platform team/i)).toBeInTheDocument();
  });
});
