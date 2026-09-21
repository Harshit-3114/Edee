'use client';

import RoleGate from './RoleGate';
import PortalShell from '@/components/shells/PortalShell';
import type { Role } from '@/lib/portals';

/**
 * The client island every portal layout mounts.
 *
 * Keeping it separate lets the layouts themselves stay Server Components, which
 * is what allows them to declare `dynamic = 'force-dynamic'`. Route segment
 * config is not available inside a client component.
 */
export default function PortalFrame({
  role,
  serverRole,
  children,
}: {
  role: Role;
  serverRole?: Role | null;
  children: React.ReactNode;
}) {
  return (
    <RoleGate role={role} serverRole={serverRole}>
      <PortalShell role={role}>{children}</PortalShell>
    </RoleGate>
  );
}
