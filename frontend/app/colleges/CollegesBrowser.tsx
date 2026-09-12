'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatFee } from '@/lib/format';
import type { College, Stream } from '@/lib/types';

const TYPE_LABEL: Record<College['type'], string> = {
  government: 'Government',
  private: 'Private',
  deemed: 'Deemed',
};

/**
 * Public college discovery. No login needed: it reads the public college
 * list, the same endpoint the landing pages are built on. Logged-in visitors
 * get the identical catalogue inside the student portal, plus shortlisting.
 */
export default function CollegesBrowser() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [search, setSearch] = useState('');
  const [stream, setStream] = useState<'' | Stream>('');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
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
          <ul className="flex flex-col gap-4">
            {colleges.map((college) => {
              const open = college.courses.filter((course) => course.active);
              const fees = open.map((course) => course.application_fee);
              const from = fees.length > 0 ? Math.min(...fees) : null;
              const href = college.slug ? `/colleges/${college.slug}` : '/student/colleges';
              return (
                <li
                  key={college.id}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold tracking-tight">
                        <Link
                          href={href}
                          className="underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--text-primary)]"
                        >
                          {college.name}
                        </Link>
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
                  <p className="mt-3">
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-text)] underline underline-offset-4"
                    >
                      View college
                      <ArrowRight size={14} weight="bold" />
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
