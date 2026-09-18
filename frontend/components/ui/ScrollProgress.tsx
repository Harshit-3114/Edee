'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-linked progress rail. Measures its parent element and fills as the
 * parent travels through the viewport. Reduced-motion users get a full rail
 * with no listener attached.
 */
export default function ScrollProgress({ vertical = false }: { vertical?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    let raf = 0;
    function update() {
      raf = 0;
      const track = ref.current;
      const scope = track?.parentElement;
      if (!track || !scope) return;
      const rect = scope.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.9;
      const end = vh * 0.35;
      const total = start - end + rect.height;
      const done = start - rect.top;
      setProgress(Math.min(1, Math.max(0, done / total)));
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pct = `${Math.round(progress * 100)}%`;
  // Full-bleed rail: every badge sits on the line. Badge centers sit 12px
  // into their cells, so a 12px-inset track passes through all four. The
  // fill follows scroll and completes once the section is traversed.
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={
        vertical
          ? 'absolute top-3 bottom-0 left-[28px] w-0.5 overflow-hidden rounded bg-[var(--line)] lg:hidden'
          : 'absolute top-3 right-3 left-3 hidden h-0.5 overflow-hidden rounded bg-[var(--line)] lg:block'
      }
    >
      <div
        className="bg-[var(--accent)]"
        style={vertical ? { height: pct, width: '100%' } : { width: pct, height: '100%' }}
      />
    </div>
  );
}
