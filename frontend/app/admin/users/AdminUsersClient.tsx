'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { UserGear } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import UserRoleForm from '@/components/admin/UserRoleForm';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { PORTAL_LABEL } from '@/lib/portals';
import type { PlatformUser } from '@/lib/types';

/**
 * The interactive half of this page.
 *
 * `initialUsers` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function AdminUsersClient({
  initialUsers,
}: {
  initialUsers: PlatformUser[] | null;
}) {
  const [users, setUsers] = useState<PlatformUser[]>(initialUsers ?? []);
  const [loading, setLoading] = useState(initialUsers === null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<PlatformUser[]>('/admin/users');
      setUsers(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load staff accounts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialUsers !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  async function toggleActive(user: PlatformUser) {
    setBusyId(user.id);
    try {
      await api.patch(`/admin/users/${user.id}`, { active: !user.active });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change that account.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Users and roles"
        description="Every staff account on the platform. Revoking access here takes effect on the account's next token refresh, within an hour."
      />

      <div className="mb-5">
        <UserRoleForm onCreated={() => void load()} />
      </div>

      {loading && <LoadingList rows={4} columns={5} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && users.length === 0 && (
        <EmptyState
          icon={<UserGear size={26} />}
          title="No staff accounts"
          body="Create the first college or coaching account above."
        />
      )}

      {!loading && !error && users.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Staff accounts and their roles</caption>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Attached to</Th>
                <Th>Created</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <span className="font-medium">{user.name}</span>
                  </Td>
                  <Td>{user.email}</Td>
                  <Td>
                    <Badge tone={user.role === 'admin' ? 'warning' : 'neutral'}>
                      {PORTAL_LABEL[user.role]}
                    </Badge>
                  </Td>
                  <Td>{user.org_name ?? 'Platform'}</Td>
                  <Td>{formatDate(user.created_at)}</Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busyId === user.id}
                      onClick={() => void toggleActive(user)}
                    >
                      {user.active ? 'Revoke' : 'Restore'}
                    </Button>
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

export type InitialData = PlatformUser[];
