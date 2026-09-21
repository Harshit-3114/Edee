'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { isValidIndianMobile, toE164 } from '@/lib/format';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

interface Props {
  onSuccess: (user: User) => void | Promise<void>;
  onError?: (message: string) => void;
}

const RESEND_SECONDS = 30;

function firebaseMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That does not look like a valid mobile number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
      return 'That code is not right. Check the SMS and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Send a new one.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for now. Try Google sign-in instead.';
    default:
      return 'Could not verify your number. Try again.';
  }
}

export default function PhoneOTPForm({ onSuccess, onError }: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // One invisible reCAPTCHA per mount. Firebase throws if two are created
  // against the same container, so this is cleaned up on unmount.
  useEffect(() => {
    try {
      verifierRef.current = new RecaptchaVerifier(
        getFirebaseAuth(),
        'recaptcha-container',
        { size: 'invisible' },
      );
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Verification is unavailable.');
    }
    return () => {
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
    // fail is stable enough for a mount-only effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

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

    if (!isValidIndianMobile(phone)) {
      fail('Enter a 10-digit Indian mobile number.');
      return;
    }
    if (!verifierRef.current) {
      fail('Verification is still loading. Try again in a moment.');
      return;
    }

    setBusy(true);
    try {
      confirmationRef.current = await signInWithPhoneNumber(
        getFirebaseAuth(),
        toE164(phone),
        verifierRef.current,
      );
      setStep('code');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      fail(firebaseMessage((err as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (code.length !== 6) {
      fail('The code is 6 digits.');
      return;
    }
    if (!confirmationRef.current) {
      fail('Send a code first.');
      return;
    }

    setBusy(true);
    try {
      const credential = await confirmationRef.current.confirm(code);
      await onSuccess(credential.user);
    } catch (err) {
      fail(firebaseMessage((err as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  }

  const phoneStep = (
      <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
        <Field
          label="Mobile number"
          hint="We send a 6-digit code by SMS."
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

  const codeStep = (
    <form onSubmit={verifyCode} className="flex flex-col gap-4" noValidate>
      <Field
        label="Verification code"
        hint={`Sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}`}
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
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="123456"
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

        <button
          type="button"
          disabled={cooldown > 0 || busy}
          onClick={() => void sendCode()}
          className="text-[var(--accent-text)] underline underline-offset-4 disabled:text-[var(--text-muted)] disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );

  return (
    <div>
      {step === 'phone' ? phoneStep : codeStep}
      {/* Mounted once for the life of the component. The verifier holds a
          reference to this node, so it must not unmount between steps. */}
      <div id="recaptcha-container" />
    </div>
  );
}
