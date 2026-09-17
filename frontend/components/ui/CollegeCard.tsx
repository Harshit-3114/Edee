'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import Badge from '@/components/ui/Badge';
import { formatFee } from '@/lib/format';
import type { College } from '@/lib/types';

const TYPE_LABEL: Record<College['type'], string> = {
  government: 'Government',
  private: 'Private',
  deemed: 'Deemed',
};

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
      <Link href={href} className="block" aria-label={`${college.name} details`}>
        {/* Hero image placeholder */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg bg-[var(--surface-sunken)]">
          {college.landing_hero_image_url ? (
            <Image
              src={college.landing_hero_image_url}
              alt=""
              fill
              className="object-cover transition-transform duration-500 hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]">
              <span className="text-xs uppercase tracking-wider">{TYPE_LABEL[college.type]}</span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight line-clamp-1">
                {college.name}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {college.city}, {college.state}
              </p>
            </div>
            <Badge>{TYPE_LABEL[college.type]}</Badge>
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