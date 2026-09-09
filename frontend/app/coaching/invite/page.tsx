'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Ticket } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import InviteForm from '@/components/coaching/InviteForm';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { CoachingInvite } from '@/lib/types';

export default function CoachingInvitePage() {
  const [invites, setInvites] = useState<CoachingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CoachingInvite[]>('/coaching/invites');
      setInvites(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your invite codes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be denied. The code is on screen either way.
    }
  }

  function exhausted(invite: CoachingInvite): boolean {
    if (invite.uses >= invite.max_uses) return true;
    return Boolean(invite.expires_at && new Date(invite.expires_at) < new Date());
  }

  return (
    <>
      <PageHeader
        title="Invite codes"
        description="A student who enters one of these at signup is linked to your centre, and appears in your cohort."
      />

      <div className="mb-5">
        <InviteForm onCreated={() => void load()} />
      </div>

      {loading && <LoadingList rows={3} columns={4} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && invites.length === 0 && (
        <EmptyState
          icon={<Ticket size={26} />}
          title="No codes issued"
          body="Create a code above and share it with your batch."
        />
      )}

      {!loading && !error && invites.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Invite codes issued by your centre</caption>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th numeric>Used</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Copy</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <Tr key={invite.id}>
                  <Td>
                    <span className="tabular font-medium tracking-wide">
                      {invite.code}
                    </span>
                  </Td>
                  <Td numeric>
                    {invite.uses} / {invite.max_uses}
                  </Td>
                  <Td>{invite.expires_at ? formatDate(invite.expires_at) : 'No expiry'}</Td>
                  <Td>
                    <Badge tone={exhausted(invite) ? 'neutral' : 'success'}>
                      {exhausted(invite) ? 'Closed' : 'Active'}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copy(invite.code)}
                      aria-label={`Copy code ${invite.code}`}
                    >
                      <Copy size={14} />
                      {copied === invite.code ? 'Copied' : 'Copy'}
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
