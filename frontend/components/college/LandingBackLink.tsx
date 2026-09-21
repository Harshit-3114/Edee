'use client';

import BackLink from '@/components/ui/BackLink';
import { useRole } from '@/hooks/useRole';
import type { Role } from '@/lib/portals';

/**
 * Where "back" goes from a public college landing page.
 *
 * The landing page sits outside every portal prefix, so it renders without a
 * PortalShell. A signed-in visitor who arrived from their portal used to be
 * sent to the marketing home page — no portal nav, no avatar, a "Sign in"
 * button in the header. The session was never cleared, but every signal of it
 * was gone, which reads as being logged out. Send people back to the portal
 * they came from instead, and keep "/" for visitors who really are signed out.
 */
const PORTAL_BACK: Record<Role, { href: string; label: string }> = {
  student: { href: '/student/colleges', label: 'Find colleges' },
  college: { href: '/college/dashboard', label: 'Dashboard' },
  coaching: { href: '/coaching/dashboard', label: 'Dashboard' },
  admin: { href: '/admin/colleges', label: 'All colleges' },
};

const PUBLIC_BACK = { href: '/', label: 'Home' };

export default function LandingBackLink() {
  const { role, loading } = useRole();
  const target = !loading && role ? PORTAL_BACK[role] : PUBLIC_BACK;
  return <BackLink href={target.href} label={target.label} />;
}
