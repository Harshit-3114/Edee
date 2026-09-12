'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Unhandled page error:', error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-5 px-6 text-center"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        The page did not load. Trying again usually helps; if it does not, sign out and
        back in.
      </p>
      <div className="flex justify-center">
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
