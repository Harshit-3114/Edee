'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { isDevModeForced } from '@/lib/devSession';
import { useDevBypass } from '@/components/auth/DevSignIn';
import { setLocalToken } from '@/lib/localSession';
import api, { apiErrorMessage } from '@/lib/api';
import { isValidIndianMobile } from '@/lib/format';
import { PORTAL_HOME } from '@/lib/portals';
import { syncSessionCookie } from '@/lib/session';
import { startServerSession } from '@/lib/clientSession';
import type { Stream } from '@/lib/types';

/**
 * Student signup. The only signup on the platform - college and coaching
 * accounts are created by an admin and arrive as a set-password link, and the
 * admin account is seeded.
 *
 * Password signup is a stopgap until Firebase arrives. The page has two modes,
 * because until then there are two ways to become a student:
 *
 *   No Firebase user  -> a real signup. Name, email, phone and a password,
 *                        posted to /auth/signup, which creates the credential
 *                        and the student row together. Offered only while no
 *                        Firebase project is configured; afterwards a bare
 *                        visit bounces to /login, where Google/OTP routes new
 *                        students here for profile completion.
 *   A Firebase user   -> profile completion, as before. They already proved
 *                        who they are with Google or an OTP, so there is no
 *                        password to set; /students/ grants the student role.
 *
 * Lives at /signup rather than /student/signup on purpose: at this point
 * nobody has a role claim, so anything under /student would be turned away
 * twice over - by the edge guard, which sees no role cookie, and by RoleGate,
 * which sees no claim.
 */
export default function SignupClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const devBypass = useDevBypass();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [stream, setStream] = useState<Stream | ''>('');
  const [inviteCode, setInviteCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Firebase already verified who they are, so this is the shorter form: no
  // password, and the identity fields are prefilled from the sign-in.
  const completingProfile = Boolean(user);

  useEffect(() => {
    if (!user) return;
    setName((value) => value || user.displayName || '');
    setEmail((value) => value || user.email || '');
    setPhone((value) => value || (user.phoneNumber ?? '').replace(/\D/g, '').slice(-10));
  }, [user]);

  // A role claim means this profile already exists - the backend grants the
  // claim as it creates it. Signing up again is not a thing, so send them to
  // their portal rather than showing the form a second time. Dev mode is
  // exempt, matching proxy.ts: both sign-in screens stay reachable there.
  const bouncing = !roleLoading && role !== null && !isDevModeForced();

  useEffect(() => {
    if (bouncing && role) router.replace(PORTAL_HOME[role]);
  }, [bouncing, role, router]);

  // Password signup exists only until Firebase arrives. With Firebase
  // configured, an account starts with Google or OTP on /login, which routes
  // new students here for profile completion - so a bare visit with no
  // Firebase user means go sign in first.
  const passwordSignupOff = !authLoading && devBypass === false && !user;

  useEffect(() => {
    if (passwordSignupOff) router.replace('/login?portal=student');
  }, [passwordSignupOff, router]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!isValidIndianMobile(phone)) next.phone = 'Enter a 10-digit Indian mobile number.';
    if (!stream) next.stream = 'Choose the level you are applying for.';

    if (!completingProfile) {
      // Matches the backend rule in app/models/auth.py, so a password the API
      // would refuse never gets as far as a request.
      if (password.length < 8) next.password = 'Use at least 8 characters.';
      else if (new TextEncoder().encode(password).length > 72) {
        next.password = 'That password is too long.';
      } else if (password !== confirm) next.confirm = 'Both passwords must match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    const profile = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.replace(/\D/g, '').slice(-10),
      stream,
      invite_code: inviteCode.trim() || null,
    };

    setBusy(true);
    try {
      if (completingProfile) {
        await api.post('/students/', profile);
        // The backend just granted the student claim. Refresh so middleware
        // and RoleGate can both see it, then go to the portal.
        await syncSessionCookie(user);
      } else {
        const { data } = await api.post('/auth/signup', { ...profile, password });
        // Storing the token is what signs them in: it writes the role cookie
        // the edge guard reads and makes every later request authenticated.
        if (!setLocalToken(data.token)) {
          setFormError('Your account was created, but sign-in failed. Try signing in.');
          return;
        }
      }
      // Either way there is now a credential the server can render with. The
      // welcome flag makes the dashboard confirm the new profile instead of
      // landing flat.
      await startServerSession();
      router.replace('/student/dashboard?welcome=1');
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not create your profile.'));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || roleLoading || bouncing || passwordSignupOff || (devBypass === null && !user)) {
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
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          {completingProfile ? 'Complete your profile' : 'Create your account'}
        </h1>
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

          {!completingProfile && (
            <>
              <Field
                label="Password"
                hint="At least 8 characters."
                error={errors.password}
                required
              >
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
            </>
          )}

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
            {completingProfile ? 'Create profile' : 'Create account'}
          </Button>
        </form>

        {!completingProfile && (
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Already have an account?{' '}
            <Link href="/login?portal=student" className="font-medium underline">
              Sign in
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
