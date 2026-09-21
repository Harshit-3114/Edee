'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { formatFee } from '@/lib/format';
import type { College } from '@/lib/types';

const FALLBACK_PHOTOS = [
  '/campuses/fergusson.jpg',
  '/campuses/xaviers.jpg',
  '/campuses/loyola.jpg',
  '/campuses/christ.jpg',
  '/campuses/graduation.jpg',
];

interface CollegeCardProps {
  college: College;
  index: number;
}

export default function CollegeCard({ college, index }: CollegeCardProps) {
  const open = college.courses.filter((c) => c.active);
  const fees = open.map((c) => c.application_fee);
  const from = fees.length ? Math.min(...fees) : null;
  const href = college.slug ? `/colleges/${college.slug}` : '/student/colleges';

  // Staggered entrance
  const style = {
    animationDelay: `${Math.min(index * 80, 600)}ms`,
  } as React.CSSProperties;

  return (
    <li style={style} className="card animate-fade-up">
      <Link href={href} prefetch={false} className="block" aria-label={`${college.name} details`}>
        {/* Hero image, falling back to a campus photo so no tile is ever grey */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg bg-[var(--surface-sunken)]">
          <Image
            src={college.landing_hero_image_url || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length]}
            alt=""
            fill
            className="object-cover transition-transform duration-500 hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>

        <div className="p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight line-clamp-1">
              {college.name}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {college.city}, {college.state}
            </p>
          </div>

          <p className="tabular mt-3 text-[13px] text-[var(--text-secondary)]">
            {open.length} {open.length === 1 ? 'course' : 'courses'}
            {from !== null && ` · fees from ${formatFee(from)}`}
          </p>

          <p className="mt-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-text)] underline underline-offset-4 transition-colors hover:text-[var(--accent-hover)]">
              View college
              <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </span>
          </p>
        </div>
      </Link>
    </li>
  );
}