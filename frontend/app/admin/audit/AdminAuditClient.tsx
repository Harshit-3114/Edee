'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Badge from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { PORTAL_LABEL, ROLES, isRole } from '@/lib/portals';
import type { AuditEvent } from '@/lib/types';

/**
 * The interactive half of this page.
 *
 * `initialEvents` is the unfiltered list the server already fetched with the session
 * cookie - which is exactly what shows before anyone touches a filter. Null
 * means the server could not fetch, and this loads it on mount as before.
 */
export default function AdminAuditClient({
  initialEvents,
}: {
  initialEvents: AuditEvent[] | null;
}) {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents ?? []);
  const [actorRole, setActorRole] = useState('');
  const [loading, setLoading] = useState(initialEvents === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AuditEvent[]>('/admin/audit', {
        params: { actor_role: actorRole || undefined },
      });
      setEvents(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the audit log.'));
    } finally {
      setLoading(false);
    }
  }, [actorRole]);

  // Skips exactly one run: the initial, unfiltered fetch the server already
  // did. Cleared immediately, so every later filter change still loads.
  const served = useRef(initialEvents !== null);
  useEffect(() => {
    if (served.current) {
      served.current = false;
      return;
    }
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only. Rows are written by the backend and cannot be edited or removed from here."
      />

      <div className="mb-5">
        <label htmlFor="audit-role" className="sr-only">
          Filter by who acted
        </label>
        <Select
          id="audit-role"
          value={actorRole}
          onChange={(event) => setActorRole(event.target.value)}
          className="h-9 w-auto text-[13px]"
        >
          <option value="">Everyone</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {PORTAL_LABEL[role]}
            </option>
          ))}
        </Select>
      </div>

      {loading && <LoadingList rows={8} columns={4} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && events.length === 0 && (
        <EmptyState
          icon={<ClockCounterClockwise size={26} />}
          title="Nothing recorded"
          body={
            actorRole
              ? 'No events from this role yet. Try a different filter.'
              : 'Events appear here as people act on the platform.'
          }
        />
      )}

      {!loading && !error && events.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Audit events</caption>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <Tr key={event.id}>
                  <Td>{formatDate(event.created_at)}</Td>
                  <Td>
                    <Badge>
                      {isRole(event.actor_role)
                        ? PORTAL_LABEL[event.actor_role]
                        : (event.actor_role ?? 'System')}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="tabular text-[13px]">{event.action}</span>
                  </Td>
                  <Td>
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      {event.entity_type ?? '-'}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

export type InitialData = AuditEvent[];
