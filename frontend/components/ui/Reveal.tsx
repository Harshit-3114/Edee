'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-triggered entrance for below-fold content.
 *
 * CSS-only motion (opacity + translate, GPU properties): when the element
 * scrolls into view it earns the same `rise` treatment mount animations use.
 * Renders visible by default so server output and no-JS readers see the
 * content; only after JS arms the observer does it hide-until-visible. Older
 * browsers without IntersectionObserver keep everything visible.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in ms for siblings entering together. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    setArmed(true);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const state = shown ? 'reveal is-visible' : armed ? 'reveal' : '';

  return (
    <div
      ref={ref}
      className={[state, className].filter(Boolean).join(' ')}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
