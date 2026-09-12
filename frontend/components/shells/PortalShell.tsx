'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { List, SignOut, X } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { PORTAL_LABEL, type Role } from '@/lib/portals';
import { PORTAL_NAV } from './nav';

/**
 * One shell for all four portals.
 *
 * Desktop gets a fixed sidebar, mobile a disclosure drawer. The portal name is
 * the only branding difference; the accent stays the same product-wide so
 * moving between portals does not feel like moving between products.
 */
export default function PortalShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const items = PORTAL_NAV[role];

  // A route change means the drawer has done its job.
  useEffect(() => setOpen(false), [pathname]);

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[15rem_1fr]">
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 md:hidden">
        <span className="text-sm font-semibold">{PORTAL_LABEL[role]}</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="portal-nav"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line-strong)]"
        >
          {open ? <X size={16} weight="bold" /> : <List size={16} weight="bold" />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </header>

      <nav
        id="portal-nav"
        hidden={!open}
        className="border-b border-[var(--line)] bg-[var(--surface-raised)] md:sticky md:top-0 md:!block md:h-[100dvh] md:border-r md:border-b-0"
      >
        <div className="hidden items-baseline gap-2 px-5 py-5 md:flex">
          <span className="text-sm font-semibold tracking-tight">Edee Apply</span>
          <span className="text-[13px] text-[var(--text-muted)]">
            {PORTAL_LABEL[role]}
          </span>
        </div>

        <ul className="flex flex-col gap-0.5 p-2 md:px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--accent-subtle)] font-medium text-[var(--accent-text)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-[var(--line)] p-3 md:absolute md:inset-x-0 md:bottom-0 md:bg-[var(--surface-raised)]">
          {user?.email && (
            <p className="truncate px-3 pb-2 text-xs text-[var(--text-muted)]">
              {user.email}
            </p>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <SignOut size={16} />
            Sign out
          </button>
        </div>
      </nav>

      <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
