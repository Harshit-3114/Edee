'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { List, SignOut, X } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { PORTAL_LABEL, type Role } from '@/lib/portals';
import { PORTAL_NAV } from './nav';
import NotificationBell from './NotificationBell';

/**
 * One top header for all four portals — the nav lives in the header.
 *
 * Brand + portal label, horizontal nav links, user avatar, and a red
 * sign-out button. Mobile gets a hamburger disclosure panel. Portal identity comes from the nav and the
 * content, never from a different palette.
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

  // A route change means the menu has done its job.
  useEffect(() => setOpen(false), [pathname]);

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  function linkClass(active: boolean) {
    return `rounded-lg px-3 py-2 text-sm transition-colors ${
      active
        ? 'bg-white/15 font-semibold text-white'
        : 'font-normal text-white/75 hover:bg-white/10 hover:text-white'
    }`;
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--surface)]">
      <header className="sticky top-0 z-30 bg-[var(--pine)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <Link href={PORTAL_NAV[role][0].href} className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              priority
              className="rounded-md bg-white/95 p-0.5"
            />
            <span className="flex items-baseline gap-2">
              <span className="font-serif text-base font-semibold tracking-tight text-white">
                Edee Apply
              </span>
              <span className="hidden text-[13px] text-white/70 sm:inline">
                {PORTAL_LABEL[role]}
              </span>
            </span>
          </Link>

          <nav aria-label="Portal" className="ml-2 hidden items-center gap-0.5 lg:flex">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={linkClass(active)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="hidden sm:block">
              <NotificationBell enabled={Boolean(user)} />
            </div>
            {user?.email && (
              <span
                aria-hidden="true"
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white sm:inline-flex"
              >
                {user.email.slice(0, 1).toUpperCase()}
              </span>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="hidden items-center gap-2 rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition-opacity hover:opacity-90 md:inline-flex"
            >
              <SignOut size={16} />
              Sign out
            </button>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="portal-nav"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 text-white lg:hidden"
            >
              {open ? <X size={16} weight="bold" /> : <List size={16} weight="bold" />}
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="portal-nav"
            aria-label="Portal"
            className="border-t border-white/15 px-4 py-3 lg:hidden"
          >
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={linkClass(active)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:hidden"
            >
              <SignOut size={16} />
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto max-w-7xl min-w-0 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
