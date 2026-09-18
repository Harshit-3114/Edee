'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import Badge, { type Tone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Panel } from '@/components/ui/DetailList';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ServiceStatusValue, SystemStatus } from '@/lib/types';

const TONE: Record<ServiceStatusValue, Tone> = {
  operational: 'success',
  degraded: 'warning',
  down: 'danger',
};

const LABEL: Record<ServiceStatusValue, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

/**
 * The interactive half of this page.
 *
 * `initialStatus` is the check the server already ran with the session cookie.
 * Refresh still reruns every check on demand.
 */
export default function AdminApisClient({
  initialStatus,
}: {
  initialStatus: SystemStatus | null;
}) {
  const [status, setStatus] = useState<SystemStatus | null>(initialStatus);
  const [loading, setLoading] = useState(initialStatus === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet: boolean) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await api.get<SystemStatus>('/admin/system');
      setStatus(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not check the integrations.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Only when the server could not supply it.
  const served = useRef(initialStatus !== null);
  useEffect(() => {
    if (served.current) return;
    void load(false);
  }, [load]);

  return (
    <>
      <PageHeader
        title="API status"
        description="Live checks of everything the platform depends on. Refresh reruns every check."
        action={
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            onClick={() => void load(true)}
          >
            Refresh
          </Button>
        }
      />

      {loading && <Skeleton className="h-28 w-full" />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load(false)} />}

      {!loading && !error && status && (
        <>
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3"
          >
            <Badge tone={TONE[status.overall]}>{LABEL[status.overall]}</Badge>
            <span className="text-[13px] text-[var(--text-secondary)]">
              Checked {formatDate(status.checked_at)}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {status.services.map((service) => (
              <Panel
                key={service.name}
                title={service.label}
                action={<Badge tone={TONE[service.status]}>{LABEL[service.status]}</Badge>}
              >
                <p className="text-sm text-[var(--text-primary)]">{service.detail}</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  {service.latency_ms === null
                    ? 'No round trip measured'
                    : `Responded in ${service.latency_ms} ms`}
                </p>
              </Panel>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export type InitialData = SystemStatus;
