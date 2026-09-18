'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { User } from 'firebase/auth';
import {
  Buildings,
  GraduationCap,
  ShieldCheck,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import DevSignIn, { useDevBypass } from '@/components/auth/DevSignIn';
import SiteFooter from '../_components/SiteFooter';
import SiteHeader from '../_components/SiteHeader';
import PhoneOTPForm from '@/components/auth/PhoneOTPForm';
import Button from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import {
  PORTAL_HOME,
  PORTAL_LABEL,
  isRole,
  resolvePostLoginDestination,
  type Role,
} from '@/lib/portals';
import { syncSessionCookie } from '@/lib/session';

const PORTAL_OPTIONS: { role: Role; hint: string; Icon: typeof GraduationCap }[] = [
  { role: 'student', hint: 'Applications & payments', Icon: GraduationCap },
  { role: 'college', hint: 'Applicants & courses', Icon: Buildings },
  { role: 'coaching', hint: 'Cohort progress', Icon: UsersThree },
  { role: 'admin', hint: 'Platform staff only', Icon: ShieldCheck },
];

const PORTAL_HELP: Record<Role, string> = {
  student: 'Sign in with Google or your mobile number to reach your applications.',
  college: 'Use the account your college provided. New college accounts are created by the platform team.',
  coaching:
    'Use the account your coaching centre provided. New centre accounts are created by the platform team.',
  admin: 'Platform staff only. Your account already carries the admin role.',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [routing, setRouting] = useState(false);
  const [wrongPortal, setWrongPortal] = useState<Role | null>(null);

  const next = params.get('next');
  const picked = params.get('portal');
  const portal: Role = isRole(picked) ? picked : 'student';
  // Dev backend (or no Firebase keys): the phone/Google forms below would
  // only print "not configured" errors, so the dev bypass replaces them.
  const devBypass = useDevBypass();

  function pick(nextPortal: Role) {
    setWrongPortal(null);
    setError('');
    const search = new URLSearchParams();
    search.set('portal', nextPortal);
    if (next) search.set('next', next);
    router.replace(`/login?${search.toString()}`);
  }

  async function route(signedIn: User) {
    setRouting(true);
    const role = await syncSessionCookie(signedIn);
    const action = resolvePostLoginDestination(role, portal, next);

    if (action.kind === 'signup') {
      // A Firebase account with no role claim is a student who has not
      // finished signing up. Staff accounts always arrive with a claim.
      router.replace('/signup');
      return;
    }
    if (action.kind === 'mismatch') {
      // Signed in fine, wrong door: say so and offer the right one instead
      // of silently landing them somewhere they did not ask for.
      setWrongPortal(action.actual);
      setError(
        `This account belongs to the ${PORTAL_LABEL[action.actual]} portal, not ${PORTAL_LABEL[portal]}.`,
      );
      setRouting(false);
      return;
    }
    router.replace(action.path);
  }

  // Already signed in? Do not make them do it twice.
  useEffect(() => {
    if (!loading && user && !routing) void route(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  if (loading || routing) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <span className="sr-only">Signing you in</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <>
      <div role="group" aria-label="Choose your portal" className="grid grid-cols-4 gap-2">
        {PORTAL_OPTIONS.map(({ role, Icon }) => {
          const selected = role === portal;
          return (
            <button
              key={role}
              type="button"
              aria-pressed={selected}
              onClick={() => pick(role)}
              className={[
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-150',
                selected
                  ? 'border-[var(--accent-line)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--line)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)]',
              ].join(' ')}
            >
              <Icon
                size={22}
                aria-hidden="true"
                className={selected ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}
              />
              <span className="text-[13px] font-medium leading-none">{PORTAL_LABEL[role]}</span>
            </button>
          );
        })}
      </div>

      {devBypass === null ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <span className="sr-only">Loading sign-in</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : devBypass ? (
        <DevSignIn />
      ) : (
        <>
          <PhoneOTPForm onSuccess={route} onError={setError} />

          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="h-px flex-1 bg-[var(--line)]" />
            or
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <GoogleSignIn onSuccess={route} onError={setError} />
        </>
      )}

      {error && <ErrorState message={error} />}
      {wrongPortal && (
        <Button type="button" onClick={() => router.replace(PORTAL_HOME[wrongPortal])}>
          Continue to the {PORTAL_LABEL[wrongPortal]} portal
        </Button>
      )}
    </>
  );
}

export default function LoginClient() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main id="main" className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
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
              Sign in
            </h1>
            <Suspense fallback={null}>
              <PortalHelp />
            </Suspense>
          </div>

          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <LoginForm />
          </Suspense>

          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
            New here? Signing in with your mobile number creates your student account.
            College and coaching accounts are created by the platform team.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Portal-specific guidance under the heading. Separate component so it can
 *  read the search params inside its own Suspense boundary. */
function PortalHelp() {
  const params = useSearchParams();
  const picked = params.get('portal');
  const portal: Role = isRole(picked) ? picked : 'student';
  return (
    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
      {PORTAL_HELP[portal]}
    </p>
  );
}
