'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { apiErrorMessage } from '@/lib/api';
import type { College, CollegeQuery } from '@/lib/types';

const PAGE_SIZE = 12;

/**
 * College search with a debounced text query.
 *
 * The abort ref matters: a fast typist fires several searches and the responses
 * do not necessarily come back in order. Without it the list can settle on the
 * results for a prefix the user has already moved past.
 */
/**
 * `initialColleges` is the unfiltered first page a server component already
 * fetched - exactly what this shows before anyone types or picks a filter.
 * Only the first effect run is skipped; every search and filter change still
 * goes to the network, debounce and abort behaviour untouched.
 */
export function useColleges(query: CollegeQuery, initialColleges?: College[] | null) {
  const [colleges, setColleges] = useState<College[]>(initialColleges ?? []);
  const [loading, setLoading] = useState(!initialColleges);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(
    initialColleges ? initialColleges.length === PAGE_SIZE : false,
  );
  const [offset, setOffset] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const { search, stream, state, type } = query;

  const fetchPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const { data } = await api.get<College[]>('/colleges/', {
          params: {
            search: search || undefined,
            stream: stream || undefined,
            state: state || undefined,
            type: type || undefined,
            limit: PAGE_SIZE,
            offset: nextOffset,
          },
          signal: controller.signal,
        });
        setColleges((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === PAGE_SIZE);
        setOffset(nextOffset);
        setError('');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(apiErrorMessage(err, 'Could not load colleges.'));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [search, stream, state, type],
  );

  // Skips exactly one run: the unfiltered first page the server already
  // fetched. Cleared immediately, so searching and filtering still work.
  const served = useRef(Boolean(initialColleges));
  useEffect(() => {
    if (served.current) {
      served.current = false;
      return;
    }
    const timer = setTimeout(() => void fetchPage(0, false), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPage, search]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) void fetchPage(offset + PAGE_SIZE, true);
  }, [fetchPage, hasMore, loadingMore, offset]);

  return { colleges, loading, loadingMore, error, hasMore, loadMore };
}
