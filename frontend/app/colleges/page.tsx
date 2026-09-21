import type { Metadata } from 'next';
import Image from 'next/image';
import SiteFooter from '@/app/(public)/_components/SiteFooter';
import SiteHeader from '@/app/(public)/_components/SiteHeader';
import CollegesBrowser from './CollegesBrowser';
import { publicGet } from '@/lib/serverApi';
import type { College } from '@/lib/types';

export const metadata: Metadata = { title: 'Browse colleges' };

/**
 * Rendered per request, not baked at build time.
 *
 * This page now fetches the catalogue on the server. Prerendering it would run
 * that fetch during `next build` - in CI and in the Docker image build, where
 * the API is not reachable - and ship a permanently empty catalogue that the
 * CDN would then hold for an hour. Rendering per request and letting the
 * Cache-Control in next.config do the caching gets the same speed without
 * freezing a build-time failure into the page.
 */
export const dynamic = 'force-dynamic';

/**
 * Public catalogue. Deliberately outside /student so logged-out visitors can
 * browse; signing in adds shortlisting and checkout on the same data.
 */
export default async function PublicCollegesPage() {
  // Public data, the same for everyone, so it renders into the cached HTML
  // instead of every visitor's browser asking for it after load.
  const initialColleges = await publicGet<College[]>('/colleges/?limit=50');

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main id="main">
        <div className="relative overflow-hidden">
          <Image
            src="/campuses/graduation.jpg"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70"
          />
          <div className="relative mx-auto max-w-3xl px-6 py-14 lg:py-20">
            <p className="text-[13px] font-medium tracking-wide text-white/70 uppercase">
              Public catalogue
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Browse colleges
            </h1>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/85 md:text-base">
              Every college below has a public landing page. Sign in to shortlist
              courses and pay application fees.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <CollegesBrowser initialColleges={initialColleges} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
