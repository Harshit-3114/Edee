'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { EnvelopeOpen } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  purpose: string;
  message: string;
  created_at: string;
}

/**
 * The interactive half of this page.
 *
 * `initialMessages` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function AdminInboxClient({
  initialMessages,
}: {
  initialMessages: ContactMessage[] | null;
}) {
  const [messages, setMessages] = useState<ContactMessage[]>(initialMessages ?? []);
  const [loading, setLoading] = useState(initialMessages === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ContactMessage[]>('/admin/contact-messages');
      setMessages(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the inbox.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialMessages !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Messages sent through the public contact form. Reply from your own email client."
      />

      {loading && <LoadingList rows={6} columns={4} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && messages.length === 0 && (
        <EmptyState
          icon={<EnvelopeOpen size={26} />}
          title="Inbox zero"
          body="Visitor messages land here as soon as someone writes in."
        />
      )}

      {!loading && !error && messages.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Contact messages</caption>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>From</Th>
                <Th>Purpose</Th>
                <Th>Message</Th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <Tr key={message.id}>
                  <Td>
                    <span className="tabular whitespace-nowrap text-[13px]">
                      {formatDate(message.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <span className="block text-sm font-medium">{message.name}</span>
                    <span className="block text-[13px] text-[var(--text-secondary)]">
                      {message.email}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[13px]">{message.purpose}</span>
                  </Td>
                  <Td>
                    <span className="block max-w-[52ch] text-[13px] leading-relaxed whitespace-pre-wrap">
                      {message.message}
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

export type InitialData = ContactMessage[];
