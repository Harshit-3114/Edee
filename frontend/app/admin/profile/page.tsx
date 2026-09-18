'use client';

import { CheckCircle, Info } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import { PORTAL_NAV } from '@/components/shells/nav';
import Badge from '@/components/ui/Badge';
import { DetailItem, DetailList, Panel } from '@/components/ui/DetailList';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';

/**
 * The admin's own account page. Deliberately basic and read-only.
 *
 * There is no admin hierarchy in the platform yet: app/middleware/auth.py
 * carries a flat set of four roles, with no tier claim and no column behind
 * it, so every admin can reach every section below. Rather than invent levels
 * that nothing enforces, this page states the access that actually exists and
 * leaves the shape for the team to fill in. When tiers do land, this is the
 * page that renders them and PORTAL_NAV.admin is the list to filter.
 */
export default function AdminProfilePage() {
  const { user } = useAuth();
  const { role } = useRole();
  const sections = PORTAL_NAV.admin;

  return (
    <>
      <PageHeader
        title="Your account"
        description="Who you are signed in as, and what that lets you open in this portal."
      />

      <div className="flex flex-col gap-6">
        <Panel title="Identity">
          <DetailList>
            <DetailItem label="Email">
              {user?.email ?? <span className="text-[var(--text-muted)]">Not available</span>}
            </DetailItem>
            <DetailItem label="Account ID" mono>
              {user?.uid ?? <span className="text-[var(--text-muted)]">Not available</span>}
            </DetailItem>
            <DetailItem label="Role">
              <Badge tone="action">{role ?? 'admin'}</Badge>
            </DetailItem>
            <DetailItem label="Signed in with">
              {user?.providerData?.[0]?.providerId ?? 'Developer token'}
            </DetailItem>
          </DetailList>
        </Panel>

        <Panel title={`Access · ${sections.length} sections`}>
          <ul className="flex flex-col gap-2">
            {sections.map((section) => (
              <li key={section.href} className="flex items-center gap-2 text-sm">
                <CheckCircle
                  size={16}
                  weight="fill"
                  aria-hidden="true"
                  className="shrink-0 text-[var(--success)]"
                />
                {section.label}
              </li>
            ))}
          </ul>

          <p className="mt-5 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              Tiered admin access is not implemented yet — every admin account can open
              every section listed above. Once levels are agreed, this is where they will
              be shown and this list is what they will narrow.
            </span>
          </p>
        </Panel>
      </div>
    </>
  );
}
