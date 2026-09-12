import Link from 'next/link';

const SITE_LINKS = [
  { href: '/colleges', label: 'Colleges' },
  { href: '/why-us', label: 'Why us' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

/** Shared footer for every public page. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight">Edee Apply</p>
          <p className="mt-2 max-w-[42ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
            One shortlist, one payment, every college application tracked.
            Application fees are set by each college and are not refundable.
          </p>
        </div>
        <nav aria-label="Site" className="flex gap-10 text-sm">
          <div className="flex flex-col gap-2.5">
            {SITE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  );
}
