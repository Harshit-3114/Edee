'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { setLocalToken } from '@/lib/localSession';
import { PORTAL_HOME, PORTAL_LABEL, isRole } from '@/lib/portals';
import { startServerSession } from '@/lib/clientSession';

interface InviteDetail {
  email: string;
  name: string;
  role: string;
  organisation: string;
}

/**
 * Where a college or coaching invite link lands.
 *
 * These portals have no signup: an admin issues a single-use link and whoever
 * opens it chooses a password. The account does not exist until they do, so
 * this page is the account creation step, not a password reset.
 *
 * The token in the query string is the whole credential. It is sent to the API
 * to be looked up by hash and never stored anywhere on this side.
 */
function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [invite, setInvite] = useState<InviteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid('This link is missing its invite code.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/auth/invites/${encodeURIComponent(token)}`);
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (!cancelled) {
          setInvalid(apiErrorMessage(err, 'This invite link is not valid any more.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    // Matches the backend rule in app/models/auth.py.
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    else if (new TextEncoder().encode(password).length > 72) {
      next.password = 'That password is too long.';
    } else if (password !== confirm) next.confirm = 'Both passwords must match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!token || !validate()) return;

    setBusy(true);
    try {
      const { data } = await api.post(
        `/auth/invites/${encodeURIComponent(token)}/accept`,
        { password },
      );
      const claims = setLocalToken(data.token);
      if (!claims) {
        setFormError('Your account was created, but sign-in failed. Try signing in.');
        return;
      }
      await startServerSession();
      router.replace(PORTAL_HOME[claims.role]);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not set your password.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <span className="sr-only">Checking your invite</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (invalid || !invite) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState message={invalid || 'This invite link is not valid any more.'} />
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Invite links expire, and each one works only once. Ask the platform team
          to send you a new one, or{' '}
          <Link href="/login" className="font-medium underline">
            sign in
          </Link>{' '}
          if your account is already set up.
        </p>
      </div>
    );
  }

  const portalLabel = isRole(invite.role) ? PORTAL_LABEL[invite.role] : invite.role;

  return (
    <>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Setting up the {portalLabel.toLowerCase()} account for{' '}
        <strong className="font-medium text-[var(--text-primary)]">
          {invite.organisation}
        </strong>
        . You will sign in as{' '}
        <strong className="font-medium text-[var(--text-primary)]">{invite.email}</strong>
        .
      </p>

      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Password" hint="At least 8 characters." error={errors.password} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
        </Field>

        <Field label="Confirm password" error={errors.confirm} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
        </Field>

        {formError && <ErrorState message={formError} />}

        <Button type="submit" loading={busy}>
          Set password and continue
        </Button>
      </form>
    </>
  );
}

export default function SetPasswordClient() {
  return (
    <main
      id="main"
      className="relative flex min-h-[100dvh] items-center justify-center px-4 py-12 sm:px-6"
    >
      <Image
        src="/campuses/graduation.jpg"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70"
      />

      <div className="rise relative flex w-full max-w-xl flex-col gap-6 rounded-xl border border-white/20 bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-md)] sm:p-10">
        <div>
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Edee Apply">
            <Image src="/logo.png" alt="" width={32} height={32} priority />
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              Edee Apply
            </span>
          </Link>
          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Choose a password
          </h1>
        </div>

        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
