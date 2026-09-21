'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Receipt } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Badge from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate, formatFee } from '@/lib/format';
import type { PaymentRow } from '@/lib/types';

/**
 * The interactive half of this page.
 *
 * `initialPayments` is the unfiltered list the server already fetched with the session
 * cookie - which is exactly what shows before anyone touches a filter. Null
 * means the server could not fetch, and this loads it on mount as before.
 */
export default function AdminPaymentsClient({
  initialPayments,
}: {
  initialPayments: PaymentRow[] | null;
}) {
  const [payments, setPayments] = useState<PaymentRow[]>(initialPayments ?? []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(initialPayments === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PaymentRow[]>('/admin/payments', {
        params: { search: search || undefined },
      });
      setPayments(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the ledger.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Skips exactly one run: the initial, unfiltered fetch the server already
  // did. Cleared immediately, so every later filter change still loads.
  const served = useRef(initialPayments !== null);
  useEffect(() => {
    if (served.current) {
      served.current = false;
      return;
    }
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every verified payment, newest first. Search by student name or Razorpay payment id when reconciling."
      />

      <div className="mb-5 sm:max-w-xs">
        <label htmlFor="payment-search" className="sr-only">
          Search payments
        </label>
        <Input
          id="payment-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Student name or payment id"
        />
      </div>

      {loading && <LoadingList rows={6} columns={5} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && payments.length === 0 && (
        <EmptyState
          icon={<Receipt size={26} />}
          title={search ? 'No payments match' : 'No payments yet'}
          body={
            search
              ? 'Check the spelling, or search by the Razorpay payment id instead.'
              : 'Payments appear here once Razorpay confirms them and the webhook is processed.'
          }
        />
      )}

      {!loading && !error && payments.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Verified payments</caption>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Payment id</Th>
                <Th numeric>Amount</Th>
                <Th>Status</Th>
                <Th>Verified</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <Tr key={payment.id}>
                  <Td>
                    <span className="font-medium">{payment.student_name}</span>
                  </Td>
                  <Td>
                    <span className="tabular text-[13px]">
                      {payment.razorpay_payment_id}
                    </span>
                  </Td>
                  <Td numeric>{formatFee(payment.amount)}</Td>
                  <Td>
                    <Badge tone={payment.status === 'captured' ? 'success' : 'warning'}>
                      {payment.status}
                    </Badge>
                  </Td>
                  <Td>{formatDate(payment.verified_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

export type InitialData = PaymentRow[];
