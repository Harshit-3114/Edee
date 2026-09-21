import type { Metadata, Viewport } from 'next';
// Latin subsets only, and only the weights the UI actually renders. The full
// imports declared cyrillic, vietnamese and devanagari faces that no page can
// reach, plus a Poppins 500 that nothing uses. unicode-range meant those files
// were never downloaded, but every declaration still shipped in the CSS.
import '@fontsource/mulish/latin-400.css';
import '@fontsource/mulish/latin-500.css';
import '@fontsource/mulish/latin-600.css';
import '@fontsource/mulish/latin-700.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import './globals.css';
import SessionTimeout from '@/components/auth/SessionTimeout';

export const metadata: Metadata = {
  title: {
    default: 'Edee Apply',
    template: '%s · Edee Apply',
  },
  description:
    'Search colleges, shortlist courses, and pay application fees for UG and PG admissions across India.',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0e11' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--surface-raised)] focus:px-4 focus:py-2 focus:text-sm focus:shadow-[var(--shadow-md)]"
        >
          Skip to content
        </a>
        <SessionTimeout />
        {children}
      </body>
    </html>
  );
}
