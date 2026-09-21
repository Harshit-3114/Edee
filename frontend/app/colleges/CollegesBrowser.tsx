'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import type { College, Stream } from '@/lib/types';
import CollegeCard from '@/components/ui/CollegeCard';

/**
 * Public college discovery. No login needed: it reads the public college
 * list, the same endpoint the landing pages are built on. Logged-in visitors
 * get the identical catalogue inside the student portal, plus shortlisting.
 */
export default function CollegesBrowser({
  initialColleges,
}: {
  /**
   * The unfiltered catalogue, rendered on the server. Public data, identical
   * for every visitor, so it is safe to sit inside the cached HTML of this
   * page - and it means the catalogue is cached with the page rather than
   * fetched again by every browser that opens it.
   */
  initialColleges: College[] | null;
}) {
  const [colleges, setColleges] = useState<College[]>(initialColleges ?? []);
  const [search, setSearch] = useState('');
  const [stream, setStream] = useState<'' | Stream>('');
  const [loading, setLoading] = useState(initialColleges === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<College[]>('/colleges/', {
        params: {
          search: search.trim() || undefined,
          stream: stream || undefined,
          limit: 50,
        },
      });
      setColleges(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load colleges.'));
    } finally {
      setLoading(false);
    }
  }, [search, stream]);

  // Skips exactly one run: the unfiltered catalogue the server already
  // rendered. Cleared immediately, so searching and filtering still work.
  const served = useRef(initialColleges !== null);
  useEffect(() => {
    if (served.current) {
      served.current = false;
      return;
    }
    const timer = setTimeout(() => void load(), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <div className="flex-1">
          <label htmlFor="public-search" className="sr-only">
            Search colleges
          </label>
          <Input
            id="public-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by college name or state"
            autoComplete="off"
          />
        </div>
        <div className="sm:w-44">
          <label htmlFor="public-stream" className="sr-only">
            Filter by level
          </label>
          <Select
            id="public-stream"
            value={stream}
            onChange={(event) => setStream(event.target.value as '' | Stream)}
          >
            <option value="">UG and PG</option>
            <option value="UG">Undergraduate</option>
            <option value="PG">Postgraduate</option>
          </Select>
        </div>
      </form>

      <div className="mt-6" aria-live="polite">
        {loading && <LoadingList rows={3} />}

        {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

        {!loading && !error && colleges.length === 0 && (
          <EmptyState
            title="No colleges match"
            body="Try a different search, or clear the filters to browse everything."
          />
        )}

        {!loading && !error && colleges.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {colleges.map((college, idx) => (
              <CollegeCard key={college.id} college={college} index={idx} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
