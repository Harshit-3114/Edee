'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { apiErrorMessage } from '@/lib/api';
import { cachedGet, invalidateApiCache } from '@/lib/apiCache';
import { sumFees } from '@/lib/format';
import type { ShortlistEntry } from '@/lib/types';

interface UseShortlist {
  entries: ShortlistEntry[];
  loading: boolean;
  error: string;
  /** course ids currently mid-flight, so buttons can show their own spinner */
  pending: Set<string>;
  total: number;
  has: (courseId: string) => boolean;
  add: (collegeId: string, courseId: string) => Promise<void>;
  remove: (shortlistId: string) => Promise<void>;
  toggle: (collegeId: string, courseId: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Owns the student's shortlist.
 *
 * Writes are optimistic on the button (via `pending`) but the list itself is
 * re-fetched after every mutation - the fee total drives a payment, so it is
 * worth one extra request to be sure the client and server agree.
 */
export function useShortlist(): UseShortlist {
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Read through the cache. The shortlist is read on the colleges browser, the
  // shortlist page and checkout, so moving between them used to refetch the
  // same list three times. `force` is for after a write, which must not be
  // allowed to read back a copy made before it.
  const reload = useCallback(async (force = false) => {
    try {
      if (force) invalidateApiCache('/shortlists/');
      const data = await cachedGet<ShortlistEntry[]>('/shortlists/');
      setEntries(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your shortlist.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const markPending = useCallback((courseId: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(courseId);
      else next.delete(courseId);
      return next;
    });
  }, []);

  const add = useCallback(
    async (collegeId: string, courseId: string) => {
      markPending(courseId, true);
      try {
        await api.post('/shortlists/', { college_id: collegeId, course_id: courseId });
        await reload(true);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not add that course.'));
      } finally {
        markPending(courseId, false);
      }
    },
    [markPending, reload],
  );

  const remove = useCallback(
    async (shortlistId: string) => {
      const entry = entries.find((item) => item.id === shortlistId);
      if (entry) markPending(entry.course_id, true);
      try {
        await api.delete(`/shortlists/${shortlistId}`);
        await reload(true);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not remove that course.'));
      } finally {
        if (entry) markPending(entry.course_id, false);
      }
    },
    [entries, markPending, reload],
  );

  const has = useCallback(
    (courseId: string) => entries.some((entry) => entry.course_id === courseId),
    [entries],
  );

  const toggle = useCallback(
    async (collegeId: string, courseId: string) => {
      const existing = entries.find((entry) => entry.course_id === courseId);
      if (existing) await remove(existing.id);
      else await add(collegeId, courseId);
    },
    [entries, add, remove],
  );

  const total = useMemo(
    () => sumFees(entries.map((entry) => entry.application_fee)),
    [entries],
  );

  return { entries, loading, error, pending, total, has, add, remove, toggle, reload };
}
