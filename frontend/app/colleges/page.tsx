import type { Metadata } from 'next';
import PageHeader from '@/components/shells/PageHeader';
import SiteFooter from '@/app/(public)/_components/SiteFooter';
import SiteHeader from '@/app/(public)/_components/SiteHeader';
import CollegesBrowser from './CollegesBrowser';

export const metadata: Metadata = { title: 'Browse colleges' };

/**
 * Public catalogue. Deliberately outside /student so logged-out visitors can
 * browse; signing in adds shortlisting and checkout on the same data.
 */
export default function PublicCollegesPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          title="Browse colleges"
          description="Every college below has a public landing page. Sign in to shortlist courses and pay application fees."
        />
        <CollegesBrowser />
      </main>
      <SiteFooter />
    </div>
  );
}
