import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Role } from '@/lib/portals';

const replace = vi.hoisted(() => vi.fn());
const roleState = vi.hoisted(() => ({
  role: null as Role | null,
  collegeId: null as string | null,
  coachingCentreId: null as string | null,
  loading: false,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/hooks/useRole', () => ({ useRole: () => roleState }));

const { default: RoleGate } = await import('@/components/auth/RoleGate');

function clientSays(role: Role | null, loading = false) {
  roleState.role = role;
  roleState.loading = loading;
  replace.mockClear();
}

/**
 * The gate exists because a forged cookie must not buy a rendered portal. The
 * server-verified role is allowed to shorten the wait; it is never allowed to
 * widen what gets through.
 */
describe('RoleGate', () => {
  it('renders nothing but a skeleton while the client is still resolving', () => {
    clientSays(null, true);
    render(
      <RoleGate role="student">
        <p>portal content</p>
      </RoleGate>,
    );
    expect(screen.queryByText('portal content')).not.toBeInTheDocument();
    expect(screen.getByText(/checking your access/i)).toBeInTheDocument();
  });

  it('opens on the first paint when the server verified the same role', () => {
    clientSays(null, true);
    render(
      <RoleGate role="student" serverRole="student">
        <p>portal content</p>
      </RoleGate>,
    );
    expect(screen.getByText('portal content')).toBeInTheDocument();
    expect(screen.queryByText(/checking your access/i)).not.toBeInTheDocument();
  });

  it('does not open for a server role belonging to a different portal', () => {
    clientSays(null, true);
    render(
      <RoleGate role="admin" serverRole="student">
        <p>admin content</p>
      </RoleGate>,
    );
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('still redirects once the client disagrees with the server', () => {
    // Server vouched for admin, the verified token says student. The token wins.
    clientSays('student');
    render(
      <RoleGate role="admin" serverRole="admin">
        <p>admin content</p>
      </RoleGate>,
    );
    expect(replace).toHaveBeenCalledWith('/student/dashboard');
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to login even if a cookie claimed otherwise', () => {
    clientSays(null);
    render(
      <RoleGate role="student" serverRole="student">
        <p>portal content</p>
      </RoleGate>,
    );
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/login?next='));
    expect(screen.queryByText('portal content')).not.toBeInTheDocument();
  });

  it('renders normally once the client confirms the role', () => {
    clientSays('student');
    render(
      <RoleGate role="student">
        <p>portal content</p>
      </RoleGate>,
    );
    expect(screen.getByText('portal content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
