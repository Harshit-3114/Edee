'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { isDevModeForced } from '@/lib/devSession';
import api, { apiErrorMessage } from '@/lib/api';
import { isValidIndianMobile } from '@/lib/format';
import { PORTAL_HOME } from '@/lib/portals';
import { syncSessionCookie } from '@/lib/session';
import type { Stream } from '@/lib/types';

/**
 * Lives at /signup rather than /student/signup on purpose.
 *
 * At this point the user has a Firebase account but no role claim, so anything
 * under /student would be turned away twice over: by the edge middleware, which
 * sees no role cookie, and by RoleGate, which sees no claim. The backend grants
 * the student role when this profile is created; only then is the portal open.
 */
export default function SignupClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stream, setStream] = useState<Stream | ''>('');
  const [inviteCode, setInviteCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Prefill whatever the sign-in method already told us.
  useEffect(() => {
    if (!user) return;
    setName((value) => value || user.displayName || '');
    setEmail((value) => value || user.email || '');
    setPhone((value) => value || (user.phoneNumber ?? '').replace(/\D/g, '').slice(-10));
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  // A role claim means this profile already exists - the backend grants the
  // claim as it creates it. Signing up again is not a thing, so send them to
  // their portal rather than showing the form a second time. Dev mode is
  // exempt, matching proxy.ts: both sign-in screens stay reachable there.
  const bouncing = !roleLoading && role !== null && !isDevModeForced();

  useEffect(() => {
    if (bouncing && role) router.replace(PORTAL_HOME[role]);
  }, [bouncing, role, router]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!isValidIndianMobile(phone)) next.phone = 'Enter a 10-digit Indian mobile number.';
    if (!stream) next.stream = 'Choose the level you are applying for.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    setBusy(true);
    try {
      await api.post('/students/', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, '').slice(-10),
        stream,
        invite_code: inviteCode.trim() || null,
      });
      // The backend just granted the student claim. Refresh so middleware and
      // RoleGate can both see it, then go to the portal.
      await syncSessionCookie(user);
      router.replace('/student/dashboard');
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not create your profile.'));
    } finally {
      setBusy(false);
    }
  }

  if (roleLoading || bouncing) {
    return (
      <main id="main" className="flex min-h-[100dvh] items-center justify-center px-6" role="status" aria-live="polite">
        <span className="sr-only">Taking you to your portal</span>
      </main>
    );
  }

  return (
    <main id="main" className="relative flex min-h-[100dvh] items-center justify-center px-4 py-12 sm:px-6">
      <Image
        src="/campuses/loyola.jpg"
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
      <div className="rise relative w-full max-w-xl rounded-xl border border-white/20 bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-md)] sm:p-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">Complete your profile</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        Colleges see this information on every application you send.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-5" noValidate>
        <Field label="Full name" error={errors.name} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Ananya Deshmukh"
            />
          )}
        </Field>

        <Field label="Email address" error={errors.email} required>
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

        <Field label="Mobile number" error={errors.phone} required>
          {(fieldProps) => (
            <div className="flex items-stretch gap-2">
              <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3 text-sm text-[var(--text-secondary)]">
                +91
              </span>
              <Input
                {...fieldProps}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                autoComplete="tel-national"
                placeholder="98765 43210"
              />
            </div>
          )}
        </Field>

        <Field
          label="Applying for"
          hint="This filters the courses you see. You can change it later."
          error={errors.stream}
          required
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={stream}
              onChange={(event) => setStream(event.target.value as Stream)}
            >
              <option value="">Choose a level</option>
              <option value="UG">Undergraduate</option>
              <option value="PG">Postgraduate</option>
            </Select>
          )}
        </Field>

        <Field
          label="Coaching invite code"
          hint="Optional. Links you to a coaching centre that invited you."
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              autoComplete="off"
              placeholder="e.g. X9K2M7QPRT"
            />
          )}
        </Field>

        {formError && <ErrorState message={formError} />}

        <Button type="submit" loading={busy}>
          Create profile
        </Button>
      </form>
      </div>
    </main>
  );
}
