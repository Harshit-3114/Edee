import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PORTAL_NAV } from '@/components/shells/nav';

vi.mock('@/hooks/useRole', () => ({
  useRole: () => ({ role: 'admin', collegeId: null, coachingCentreId: null, loading: false }),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb({ email: 'ops@edee.in', uid: 'uid-123', providerData: [{ providerId: 'google.com' }] });
    return () => {};
  },
  signOut: vi.fn().mockResolvedValue(undefined),
}));

const { default: AdminProfilePage } = await import('@/app/admin/profile/page');

describe('AdminProfilePage', () => {
  it('shows the signed-in admin identity', () => {
    render(<AdminProfilePage />);
    expect(screen.getByText('ops@edee.in')).toBeInTheDocument();
    expect(screen.getByText('uid-123')).toBeInTheDocument();
    expect(screen.getByText('google.com')).toBeInTheDocument();
  });

  it('lists every admin section this account can open', () => {
    render(<AdminProfilePage />);
    for (const section of PORTAL_NAV.admin) {
      expect(screen.getByText(section.label)).toBeInTheDocument();
    }
    expect(
      screen.getByText(`Access · ${PORTAL_NAV.admin.length} sections`),
    ).toBeInTheDocument();
  });

  it('says plainly that tiered access does not exist yet', () => {
    render(<AdminProfilePage />);
    expect(screen.getByText(/not implemented yet/i)).toBeInTheDocument();
    expect(screen.getByText(/every admin account can open/i)).toBeInTheDocument();
  });
});
