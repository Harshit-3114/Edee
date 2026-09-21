'use client';

import { useState } from 'react';
import { signOut as fbSignOut } from 'firebase/auth';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import api, { apiErrorMessage } from '@/lib/api';
import { useDevBypass } from '@/components/auth/DevSignIn';
import {
  clearDevToken,
  fetchBackendDevMode,
  isDevModeForced,
  setDevToken,
} from '@/lib/devSession';
import { clearLocalToken, setLocalToken } from '@/lib/localSession';
import { tryGetFirebaseAuth } from '@/lib/firebase';
import type { Role } from '@/lib/portals';

/**
 * Email and password sign-in, shared by all four portals.
 *
 * The token that comes back is stored by setLocalToken, which also writes the
 * role cookie the edge guard reads. `onSuccess` gets the role so the caller can
 * do exactly what it does after a Firebase sign-in: decide where to send them,
 * and say so when they knocked on the wrong portal's door.
 *
 * In dev mode there is no separate developer panel: this same form accepts any
 * email and password. A real credential still signs in through /auth/login;
 * anything else falls back to provisioning a mock user for the current portal,
 * so every portal is reachable with whatever you type.
 */
export default function PasswordForm({
  portal,
  onSuccess,
  onError,
}: {
  portal: Role;
  onSuccess: (role: Role) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const devBypass = useDevBypass();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    onError('');

    if (!email.trim() || !password) {
      onError('Enter your email address and password.');
      return;
    }

    setBusy(true);
    try {
      try {
        const { data } = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password,
        });
        // A real credential wins: drop any dev identity and any Firebase user
        // shadowing it, then store the local session.
        try {
          const auth = tryGetFirebaseAuth();
          if (auth?.currentUser) await fbSignOut(auth);
        } catch {
          /* real session continues regardless */
        }
        clearDevToken();
        const claims = setLocalToken(data.token);
        if (!claims) {
          onError('Could not start your session. Please try again.');
          return;
        }
        await onSuccess(claims.role);
        return;
      } catch (err) {
        // Never bypass a rate limit with a mock identity.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          onError(apiErrorMessage(err, 'Too many attempts. Try again in a minute.'));
          return;
        }
        const dev =
          devBypass ?? (isDevModeForced() || (await fetchBackendDevMode()));
        if (!dev) {
          // The API says the same thing for every failure on purpose; passing
          // it through keeps the UI from inventing a more specific reason.
          onError(apiErrorMessage(err, 'Email or password is incorrect.'));
          return;
        }
        const role = await devSignIn(email.trim());
        await onSuccess(role);
      }
    } catch (err) {
      onError(apiErrorMessage(err, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  }

  async function devSignIn(rawEmail: string): Promise<Role> {
    // A Firebase session shadows every token the API would otherwise read, so
    // leave it first. Best effort: dev continues regardless.
    try {
      const auth = tryGetFirebaseAuth();
      if (auth?.currentUser) await fbSignOut(auth);
    } catch {
      /* dev continues regardless */
    }
    clearLocalToken();

    if (portal === 'college' || portal === 'coaching') {
      const { data } = await api.get<{
        colleges: { id: string }[];
        coaching_centres: { id: string }[];
      }>('/dev/directory');
      const orgId =
        portal === 'college' ? data.colleges[0]?.id : data.coaching_centres[0]?.id;
      if (!orgId) {
        throw new Error(
          portal === 'college'
            ? 'No colleges exist yet to sign in as.'
            : 'No coaching centres exist yet to sign in as.',
        );
      }
      const body =
        portal === 'college'
          ? { role: portal, college_id: orgId }
          : { role: portal, coaching_centre_id: orgId };
      const { data: mock } = await api.post<{ token: string }>('/dev/mock-user', body);
      const claims = setDevToken(mock.token);
      if (!claims) throw new Error('Could not start a dev session.');
      return claims.role;
    }

    const { data: mock } = await api.post<{ token: string }>('/dev/mock-user', {
      role: portal,
      tag: emailToTag(rawEmail),
    });
    const claims = setDevToken(mock.token);
    if (!claims) throw new Error('Could not start a dev session.');
    return claims.role;
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

      <Field
        label="Password"
        hint={devBypass ? 'Dev mode: any email and password works.' : undefined}
        required
      >
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

/**
 * Turn whatever was typed into a valid dev tag. The mock endpoint only allows
 * letters, digits, `_` and `-`, so dots and `+` addressing become dashes. The
 * tag is part of the dev identity, so different emails stay different people
 * on the student and admin portals.
 */
function emailToTag(rawEmail: string): string {
  const local = rawEmail.split('@')[0] ?? '';
  let tag = local
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, 40);
  if (!tag || !/^[a-z0-9]/i.test(tag)) tag = 'dev';
  return tag;
}
