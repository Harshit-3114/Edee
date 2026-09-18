'use client';

import { useRouter } from 'next/navigation';
import { BookmarkSimple, Trash } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Button from '@/components/ui/Button';
import LinkButton from '@/components/ui/LinkButton';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import { useShortlist } from '@/hooks/useShortlist';
import type { ShortlistEntry } from '@/lib/types';
import { formatFee, pluralise } from '@/lib/format';

/**
 * `initialEntries` is the shortlist the server already fetched with the
 * session cookie; the hook starts loaded when it is there.
 */
export default function ShortlistClient({
  initialEntries,
}: {
  initialEntries: ShortlistEntry[] | null;
}) {
  const router = useRouter();
  const { entries, loading, error, pending, total, remove, reload } =
    useShortlist(initialEntries);

  return (
    <>
      <PageHeader
        title="Your shortlist"
        description="Add or remove courses freely. You pay once, for everything on this list."
      />

      {loading && <LoadingList rows={3} columns={3} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void reload()} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon={<BookmarkSimple size={26} />}
          title="Nothing shortlisted yet"
          body="Find a course you want to apply to and shortlist it. Everything you add shows up here with a running total."
          action={
            <LinkButton href="/student/colleges">Find colleges</LinkButton>
          }
        />
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <ul className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.college_name}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                    {entry.course_name} · {entry.city}, {entry.state}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="tabular text-sm whitespace-nowrap">
                    {formatFee(entry.application_fee)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={pending.has(entry.course_id)}
                    onClick={() => void remove(entry.id)}
                    aria-label={`Remove ${entry.course_name} at ${entry.college_name}`}
                  >
                    {!pending.has(entry.course_id) && <Trash size={15} />}
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                {pluralise(entries.length, 'application', 'applications')}
              </p>
              <p className="tabular mt-1 text-2xl font-semibold">{formatFee(total)}</p>
            </div>
            <Button onClick={() => router.push('/student/checkout')}>
              Proceed to payment
            </Button>
          </div>
        </>
      )}
    </>
  );
}
