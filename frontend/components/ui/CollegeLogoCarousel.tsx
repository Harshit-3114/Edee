"use client";

import Image from "next/image";
import { apiFileUrl } from "@/lib/format";
import type { College } from "@/lib/types";

/* --------------------------------------------------------------
   SVG placeholder – identical to the one used on the landing page
   -------------------------------------------------------------- */
const LogoPlaceholder = () => (
  <div className="flex h-full w-full items-center justify-center bg-[var(--surface-raised)] text-[var(--text-muted)]">
    <svg
      className="w-3/4 h-3/4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  </div>
);

export default function CollegeLogoCarousel({ colleges }: { colleges: College[] }) {
  /* --------------------------------------------------------------
     Build an array that has an entry for **every** college.
     If the college already has a logo_url we use it,
     otherwise we mark the entry as a placeholder.
     -------------------------------------------------------------- */
  const items = colleges.map((c) => ({
    key: c.id,
    name: c.name,
    src: c.logo_url ? apiFileUrl(c.logo_url) : null, // null → placeholder
  }));

  // Duplicate the list so the marquee can loop seamlessly
  const loop = [...items, ...items];

  return (
    <section
      className="py-8 overflow-hidden bg-[var(--surface-sunken)]"
      aria-label="Partner colleges"
    >
      <div
        className="flex animate-marquee"
        style={{ animationDuration: `${loop.length * 1.2}s` }}
      >
        {loop.map(({ key, name, src }, i) => (
          <div
            key={`${key}-${i}`}
            className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 flex items-center justify-center px-4"
            title={name}
          >
            {src ? (
              <Image
                src={src as string}
                alt={`${name} logo`}
                width={96}
                height={96}
                className="object-contain grayscale hover:grayscale-0 transition-all duration-300"
                unoptimized
              />
            ) : (
              <LogoPlaceholder />
            )}
          </div>
        ))}
      </div>

      {/* Marquee keyframes – keep them global so they don’t clash with other styles */}
      <style jsx global>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee linear infinite; }
      `}</style>
    </section>
  );
}