'use client';

import { useState } from 'react';
import { Buildings } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import CollegeCard from '@/components/student/CollegeCard';
import CollegeFilters from '@/components/student/CollegeFilters';
import CollegeSearch from '@/components/student/CollegeSearch';
import Button from '@/components/ui/Button';
import LinkButton from '@/components/ui/LinkButton';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useColleges } from '@/hooks/useColleges';
import { useShortlist } from '@/hooks/useShortlist';
import { pluralise } from '@/lib/format';
import type { CollegeQuery } from '@/lib/types';

export default function CollegesPage() {
  const [query, setQuery] = useState<CollegeQuery>({});
  const { colleges, loading, loadingMore, error, hasMore, loadMore } = useColleges(query);
  const shortlist = useShortlist();

  const filtersApplied = Boolean(query.search || query.stream || query.state || query.type);

  return (
    <>
      <PageHeader
        title="Find colleges"
        description="Search by name, then narrow by stream, state, or type. Shortlist the courses you want before paying."
        action={
          shortlist.entries.length > 0 ? (
            <LinkButton href="/student/shortlist" variant="secondary" size="sm">{pluralise(shortlist.entries.length, 'shortlisted', 'shortlisted')}</LinkButton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <CollegeSearch
          value={query.search ?? ''}
          onChange={(search) => setQuery((prev) => ({ ...prev, search }))}
        />
        <CollegeFilters value={query} onChange={setQuery} />
      </div>

      <div className="mt-6">
        {loading && (
          <div className="grid gap-4" role="status" aria-live="polite">
            <span className="sr-only">Loading colleges</span>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => setQuery({ ...query })} />
        )}

        {!loading && !error && colleges.length === 0 && (
          <EmptyState
            icon={<Buildings size={26} />}
            title={filtersApplied ? 'No colleges match those filters' : 'No colleges listed yet'}
            body={
              filtersApplied
                ? 'Try a broader search, or clear a filter or two.'
                : 'Colleges appear here as soon as they are added to the platform.'
            }
            action={
              filtersApplied ? (
                <Button variant="secondary" size="sm" onClick={() => setQuery({})}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        )}

        {!loading && !error && colleges.length > 0 && (
          <>
            <div className="grid gap-4">
              {colleges.map((college) => (
                <CollegeCard
                  key={college.id}
                  college={college}
                  isShortlisted={shortlist.has}
                  isPending={(courseId) => shortlist.pending.has(courseId)}
                  onToggle={(collegeId, courseId) =>
                    void shortlist.toggle(collegeId, courseId)
                  }
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                  Show more colleges
                </Button>
              </div>
            )}
          </>
        )}

        {shortlist.error && (
          <div className="mt-4">
            <ErrorState message={shortlist.error} onRetry={() => void shortlist.reload()} />
          </div>
        )}
      </div>
    </>
  );
}
