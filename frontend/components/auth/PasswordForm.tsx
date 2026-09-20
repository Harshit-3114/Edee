'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import api, { apiErrorMessage } from '@/lib/api';
import { setLocalToken } from '@/lib/localSession';
import type { Role } from '@/lib/portals';

/**
 * Email and password sign-in, shared by all four portals.
 *
 * The token that comes back is stored by setLocalToken, which also writes the
 * role cookie the edge guard reads. `onSuccess` gets the role so the caller can
 * do exactly what it does after a Firebase sign-in: decide where to send them,
 * and say so when they knocked on the wrong portal's door.
 */
export default function PasswordForm({
  onSuccess,
  onError,
}: {
  onSuccess: (role: Role) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    onError('');

    if (!email.trim() || !password) {
      onError('Enter your email address and password.');
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      const claims = setLocalToken(data.token);
      if (!claims) {
        onError('Could not start your session. Please try again.');
        return;
      }
      await onSuccess(claims.role);
    } catch (err) {
      // The API says the same thing for every failure on purpose; passing it
      // through keeps the UI from inventing a more specific reason.
      onError(apiErrorMessage(err, 'Email or password is incorrect.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Email address" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field label="Password" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        )}
      </Field>

      <Button type="submit" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
