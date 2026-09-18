'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { LockSimple } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import CheckoutSummary from '@/components/student/CheckoutSummary';
import Button from '@/components/ui/Button';
import LinkButton from '@/components/ui/LinkButton';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { useShortlist } from '@/hooks/useShortlist';
import type { ShortlistEntry } from '@/lib/types';
import api, { apiErrorMessage } from '@/lib/api';
import type { OrderQuote, OrderResponse } from '@/lib/types';

/** Razorpay attaches itself to window. Only the fields this page uses. */
interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

/** What Razorpay hands back when checkout succeeds. */
interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

type Phase = 'idle' | 'creating' | 'paying' | 'verifying' | 'done';

/**
 * `initialEntries` is the shortlist the server already fetched with the session
 * cookie, so checkout opens with the basket and its total already totted up.
 */
export default function CheckoutClient({
  initialEntries,
}: {
  initialEntries: ShortlistEntry[] | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { entries, loading, error: listError, total, reload } =
    useShortlist(initialEntries);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [scriptReady, setScriptReady] = useState(false);
  const [quote, setQuote] = useState<OrderQuote | null>(null);

  const busy = phase === 'creating' || phase === 'paying' || phase === 'verifying';

  useEffect(() => {
    if (phase === 'done') router.replace('/student/dashboard?paid=1');
  }, [phase, router]);

  // Price preview from the same code that will charge: totals, scholarship
  // and payable, before any money moves. Falls back to the client-side sum
  // when the quote cannot be fetched; create-order re-prices regardless.
  useEffect(() => {
    if (entries.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    api
      .post<OrderQuote>('/payments/quote', {
        shortlist_ids: entries.map((entry) => entry.id),
      })
      .then(({ data }) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const pay = useCallback(async () => {
    setError('');

    if (!scriptReady || !window.Razorpay) {
      setError('The payment window is still loading. Try again in a moment.');
      return;
    }

    setPhase('creating');
    let order: OrderResponse;
    try {
      const { data } = await api.post<OrderResponse>('/payments/create-order', {
        shortlist_ids: entries.map((entry) => entry.id),
      });
      order = data;
    } catch (err) {
      setPhase('idle');
      setError(apiErrorMessage(err, 'Could not start the payment. Try again.'));
      return;
    }

    setPhase('paying');

    const razorpay = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Edee Apply',
      description: `${entries.length} application${entries.length === 1 ? '' : 's'}`,
      prefill: {
        name: user?.displayName ?? undefined,
        email: user?.email ?? undefined,
        contact: user?.phoneNumber ?? undefined,
      },
      theme: { color: '#7f1d1d' },
      // The webhook is the source of truth for the application records. This
      // handler only confirms to the payer that the payment went through.
      //
      // All three fields go back: the API re-computes the HMAC over
      // order_id|payment_id and compares, so a forged call cannot claim a
      // payment that never happened.
      handler: async (response: RazorpaySuccess) => {
        setPhase('verifying');
        try {
          await api.post('/payments/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setPhase('done');
        } catch {
          // The payment succeeded even if this call did not. Do not alarm the
          // user or invite a second payment; the webhook reconciles.
          setPhase('done');
        }
      },
      modal: {
        ondismiss: () => {
          setPhase('idle');
          setError('Payment was cancelled. Your shortlist is unchanged.');
        },
      },
    });

    razorpay.on('payment.failed', (response) => {
      const description = (
        response as { error?: { description?: string } } | undefined
      )?.error?.description;
      setPhase('idle');
      setError(description ?? 'The payment failed. No money was taken.');
    });

    razorpay.open();
  }, [entries, scriptReady, user]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
        onError={() =>
          setError('Could not load the payment window. Check your connection and reload.')
        }
      />

      <PageHeader
        title="Checkout"
        description="One payment covers every application on your shortlist. Fees are set by each college and are not refundable once an application is submitted."
      />

      {loading && <LoadingList rows={3} columns={2} />}

      {!loading && listError && (
        <ErrorState message={listError} onRetry={() => void reload()} />
      )}

      {!loading && !listError && entries.length === 0 && (
        <EmptyState
          icon={<LockSimple size={26} />}
          title="Nothing to pay for"
          body="Your shortlist is empty, so there is no application fee to collect."
          action={
            <LinkButton href="/student/colleges">Find colleges</LinkButton>
          }
        />
      )}

      {!loading && !listError && entries.length > 0 && (
        <div className="flex flex-col gap-5">
          <CheckoutSummary entries={entries} total={total} quote={quote} />

          {error && <ErrorState message={error} />}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <LockSimple size={15} aria-hidden="true" />
              Card details are handled by Razorpay. They never reach our servers.
            </p>

            <Button onClick={() => void pay()} loading={busy} disabled={!scriptReady}>
              {phase === 'verifying' ? 'Confirming payment' : 'Pay now'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
