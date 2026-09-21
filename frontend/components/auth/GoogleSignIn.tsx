'use client';

import { useState } from 'react';
import { signInWithPopup, type User } from 'firebase/auth';
import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import Button from '@/components/ui/Button';

interface Props {
  onSuccess: (user: User) => void | Promise<void>;
  onError?: (message: string) => void;
  label?: string;
}

/** Google's wordmark, from Simple Icons, tinted to the current text colour. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

export default function GoogleSignIn({ onSuccess, onError, label = 'Continue with Google' }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
      await onSuccess(credential.user);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      // Closing the popup is a decision, not a failure. Stay quiet about it.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      onError?.(
        code === 'auth/account-exists-with-different-credential'
          ? 'That email is already registered with a different sign-in method.'
          : 'Google sign-in did not complete. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" loading={busy} onClick={handleClick} className="w-full">
      {!busy && <GoogleMark />}
      {label}
    </Button>
  );
}
