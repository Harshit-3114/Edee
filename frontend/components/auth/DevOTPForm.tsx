'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut as fbSignOut } from 'firebase/auth';
import { tryGetFirebaseAuth } from '@/lib/firebase';
import { setDevToken } from '@/lib/devSession';
import { startServerSession } from '@/lib/clientSession';
import api, { apiErrorMessage } from '@/lib/api';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

interface Props {
  onSuccess: () => void | Promise<void>;
  onError?: (message: string) => void;
}

/**
 * Dev-mode student sign-in that works like the real phone-OTP flow: a mobile
 * number, then a short code. Any 10 digits identify the mock student, any 4
 * digits verify - no Firebase, no SMS. The server provisions the mock profile
 * behind the token, so the student lands with everything working.
 *
 * Rendered only when the backend runs in dev mode; production never imports
 * this path.
 */
export default function DevOTPForm({ onSuccess, onError }: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  function fail(message: string) {
    setError(message);
    onError?.(message);
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError('');

    if (!/^\d{10}$/.test(phone)) {
      fail('Enter any 10-digit mobile number.');
      return;
    }

    // No SMS leaves this laptop: dev mode pretends one was sent.
    setBusy(true);
    try {
      const auth = tryGetFirebaseAuth();
      if (auth?.currentUser) await fbSignOut(auth);
      setStep('code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(code)) {
      fail('Enter any 4 digits - dev mode accepts them all.');
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post<{ token: string }>('/dev/mock-user', {
        role: 'student',
        tag: phone,
        phone,
      });
      const claims = setDevToken(data.token);
      if (!claims) {
        fail('Could not start a dev session.');
        return;
      }
      await startServerSession();
      await onSuccess();
    } catch (err) {
      fail(apiErrorMessage(err, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4" noValidate>
        <Field
          label="Verification code"
          hint={`Dev mode: no SMS was sent - any 4 digits verify +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}
          error={error}
          required
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="tabular tracking-[0.4em]"
            />
          )}
        </Field>

        <Button type="submit" loading={busy}>
          Verify and continue
        </Button>

        <div className="flex items-center justify-between text-[13px]">
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError('');
            }}
            className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]"
          >
            Change number
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
      <Field
        label="Mobile number"
        hint="Dev mode: sign-in mirrors phone OTP, without Firebase or SMS."
        error={error}
        required
      >
        {(fieldProps) => (
          <div className="flex items-stretch gap-2">
            <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3 text-sm text-[var(--text-secondary)]">
              +91
            </span>
            <Input
              {...fieldProps}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
              placeholder="98765 43210"
            />
          </div>
        )}
      </Field>

      <Button type="submit" loading={busy}>
        Send code
      </Button>
    </form>
  );
}
