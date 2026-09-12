'use client';

import { useEffect, useState } from 'react';
import Reveal from '@/components/ui/Reveal';
import api from '@/lib/api';
import { formatFee } from '@/lib/format';
import type { ScholarshipPolicy } from '@/lib/types';

/**
 * The volume-discount table, read live from the same policy checkout
 * charges against. Renders nothing until loaded, and hides entirely when
 * the policy cannot be fetched — a marketing section must never disagree
 * with the till, and silence beats a stale table.
 */
export default function ScholarshipSlabs() {
  const [policy, setPolicy] = useState<ScholarshipPolicy | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ScholarshipPolicy>('/payments/scholarship')
      .then(({ data }) => {
        if (!cancelled && data.slabs.length > 0) setPolicy(data);
      })
      .catch(() => {
        /* section stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!policy) return null;

  const largest = policy.slabs[policy.slabs.length - 1].min_forms;

  return (
    <section aria-labelledby="scholarship" className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <Reveal>
        <h2 id="scholarship" className="text-2xl font-semibold tracking-tight">
          The more you apply to, the bigger your scholarship
        </h2>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[var(--text-secondary)]">
          Colleges charge their own form fee. The scholarship is a discount on
          your total, applied at checkout before you pay — no codes, nothing to
          claim back later.
        </p>
      </Reveal>
      <Reveal delay={90}>
        <dl className="mt-8 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
          {policy.slabs.map((slab) => (
            <div
              key={slab.min_forms}
              className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3 text-sm last:border-b-0"
            >
              <dt className="text-[var(--text-secondary)]">
                {slab.min_forms} {slab.min_forms === 1 ? 'form' : 'forms'}
              </dt>
              <dd className="tabular font-medium text-[var(--accent-text)]">
                −{formatFee(slab.discount_paise)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
          Beyond {largest} {largest === 1 ? 'form' : 'forms'} it is a flat{' '}
          {formatFee(policy.per_form_beyond_paise)} per form.
        </p>
      </Reveal>
    </section>
  );
}
