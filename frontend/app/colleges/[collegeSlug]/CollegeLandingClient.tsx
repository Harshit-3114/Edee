'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CollegeLandingPage from '@/components/college/CollegeLandingPage';
import LinkButton from '@/components/ui/LinkButton';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Buildings } from '@phosphor-icons/react';
import api, { apiErrorMessage } from '@/lib/api';
import type { CollegeLanding } from '@/lib/types';

/**
 * Fetches the public landing payload. No login is needed: the endpoint is
 * public, and the api client only attaches a token when someone is signed in.
 */
export default function CollegeLandingClient({
  slug,
  initialCollege,
}: {
  slug: string;
  /**
   * The listing rendered on the server. Public data, identical for every
   * visitor, so it belongs in this page's cached HTML - which is also what
   * lets search engines see the college rather than a skeleton.
   */
  initialCollege?: CollegeLanding | null;
}) {
  const [college, setCollege] = useState<CollegeLanding | null>(initialCollege ?? null);
  const [loading, setLoading] = useState(!initialCollege);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CollegeLanding>(
        `/colleges/by-slug/${encodeURIComponent(slug)}`,
      );
      setCollege(data);
      setError('');
      setMissing(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) setMissing(true);
      else setError(apiErrorMessage(err, 'Could not load this college.'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Only the full load when the server could not supply it.
  const served = useRef(Boolean(initialCollege));
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  // Refresh in the background even when the server did supply it. The served
  // HTML may be edge-cached, so an admin edit can lag behind it; the visitor
  // keeps reading the served copy and it swaps to fresh data when the fetch
  // lands. Failures are silent on purpose - the served copy stays.
  useEffect(() => {
    if (!served.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<CollegeLanding>(
          `/colleges/by-slug/${encodeURIComponent(slug)}`,
        );
        if (!cancelled) {
          setCollege(data);
          setMissing(false);
        }
      } catch {
        /* keep the served copy */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-6 py-10" role="status" aria-live="polite">
        <span className="sr-only">Loading this college</span>
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  if (missing || (!error && !college)) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-6 py-10">
        <EmptyState
          icon={<Buildings size={26} />}
          title="College not found"
          body="This page may have been removed, or the link may be out of date."
          action={<LinkButton href="/student/colleges">Find colleges</LinkButton>}
        />
      </main>
    );
  }

  if (error) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-6 py-10">
        <ErrorState message={error} onRetry={() => void load()} />
      </main>
    );
  }

  if (!college) return null;

  return <CollegeLandingPage college={college} />;
}
