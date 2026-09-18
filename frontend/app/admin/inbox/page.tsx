'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function AdminInboxPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
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
