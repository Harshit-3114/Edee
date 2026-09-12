import Link from 'next/link';
import LinkButton from '@/components/ui/LinkButton';

const LINKS = [
  { href: '/colleges', label: 'Colleges' },
  { href: '/why-us', label: 'Why us' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/** Shared header for every public page: same links, same order, everywhere. */
export default function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)]">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6"
      >
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
          Edee Apply
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <LinkButton href="/login" size="sm">
          Sign in
        </LinkButton>
      </nav>
      <nav aria-label="Sections" className="border-t border-[var(--line)] md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-6 py-2.5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 text-sm text-[var(--text-secondary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
