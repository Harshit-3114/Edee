'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/** Two hours of no interaction ends the session. */
export const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;

/** Shared across tabs on purpose: a session is the user's, not the tab's. */
export const ACTIVITY_KEY = 'edee_last_activity';

/** Every interaction restamps, so throttle the writes rather than the events. */
const WRITE_THROTTLE_MS = 15_000;
const CHECK_INTERVAL_MS = 30_000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

function readStamp(): number | null {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Private mode or blocked storage. Treated as "no stamp".
    return null;
  }
}

function writeStamp(at: number): void {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // Nothing to do: the interval below falls back to an in-memory stamp.
  }
}

export function clearStamp(): void {
  try {
    window.localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Signs the user out after IDLE_LIMIT_MS without interaction.
 *
 * The clock lives in localStorage rather than in a React ref, for two reasons:
 * a second tab must not let an abandoned one keep the session alive, and a tab
 * reopened after the limit has passed must expire immediately instead of
 * starting a fresh two hours. `enabled` is false for signed-out visitors, so
 * nothing here runs for them.
 */
export function useIdleLogout(enabled: boolean): void {
  const { signOut } = useAuth();
  const router = useRouter();

  // useAuth builds a new signOut each render; a ref keeps the effect stable.
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  });

  useEffect(() => {
    if (!enabled) return;

    let lastWrite = 0;
    let done = false;

    // Keep an existing stamp: a reload is not a reason to grant another two
    // hours. Only a session with no stamp at all starts the clock now.
    if (readStamp() === null) {
      writeStamp(Date.now());
      lastWrite = Date.now();
    }

    function onActivity() {
      const now = Date.now();
      if (now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      writeStamp(now);
    }

    async function expire() {
      if (done) return;
      done = true;
      clearStamp();
      await signOutRef.current();
      router.replace('/login?timeout=1');
    }

    function check() {
      const stamp = readStamp();
      if (stamp === null) return;
      // A stamp in the future means a clock change, not two hours of use.
      const idleFor = Math.max(0, Date.now() - stamp);
      if (idleFor >= IDLE_LIMIT_MS) void expire();
    }

    // An already-expired session should not wait for the first interval.
    check();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.clearInterval(timer);
    };
  }, [enabled, router]);
}
