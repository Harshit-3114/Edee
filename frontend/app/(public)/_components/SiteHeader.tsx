'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LinkButton from '@/components/ui/LinkButton';
import UserMenu from '@/components/shells/UserMenu';
import { useRole } from '@/hooks/useRole';
import { PORTAL_HOME, PORTAL_LABEL } from '@/lib/portals';

const LINKS = [
  { href: '/colleges', label: 'Colleges' },
  { href: '/why-us', label: 'Why us' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/** Shared header for every public page: same links, same order, everywhere. */
export default function SiteHeader() {
  const pathname = usePathname() || '/';
  // A public page renders outside PortalShell, so without this the header
  // offers "Sign in" to someone who is already signed in - the whole reason
  // stepping out to a public page felt like being logged out.
  const { role, loading } = useRole();
  const signedIn = !loading && role !== null;

  function desktopClass(href: string) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return `text-sm transition-colors duration-200 hover:scale-105 ${
      active ? 'font-semibold text-white underline underline-offset-8 decoration-2' : 'text-white/75 hover:text-white'
    }`;
  }

  function mobileClass(href: string) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return `shrink-0 text-sm transition-colors duration-200 ${
      active ? 'font-semibold text-white underline underline-offset-8 decoration-2' : 'text-white/75 hover:text-white'
    }`;
  }

  return (
    <header className="bg-[var(--pine)] sticky top-0 z-40 transition-shadow duration-300 hover:shadow-md relative overflow-hidden">
      <span
        aria-hidden="true"
        className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <nav
        aria-label="Main"
        className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6"
      >
        <Link href="/" prefetch={false} className="shrink-0 flex items-center gap-2" aria-label="Edee Apply">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="rounded-md bg-white/95 p-0.5 transition-transform duration-300 hover:scale-110"
          />
          <span className="text-sm font-semibold tracking-tight text-white">Edee Apply</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={desktopClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </div>
        {signedIn ? (
          <div className="flex items-center gap-3">
            <LinkButton prefetch={false} href={PORTAL_HOME[role]} size="sm" className="btn">
              {PORTAL_LABEL[role]} portal
            </LinkButton>
            <UserMenu />
          </div>
        ) : (
          <LinkButton prefetch={false} href="/login" size="sm" className="btn">
            Sign in
          </LinkButton>
        )}
      </nav>
      <nav aria-label="Sections" className="border-t border-[var(--line)] md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-6 py-2.5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={mobileClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
