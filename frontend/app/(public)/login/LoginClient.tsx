'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
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
import PasswordForm from '@/components/auth/PasswordForm';
import DevSignIn, { useDevBypass } from '@/components/auth/DevSignIn';
import DevOTPForm from '@/components/auth/DevOTPForm';
import SiteFooter from '../_components/SiteFooter';
import SiteHeader from '../_components/SiteHeader';
import PhoneOTPForm from '@/components/auth/PhoneOTPForm';
import Button from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { isDevModeForced } from '@/lib/devSession';
import { startServerSession } from '@/lib/clientSession';
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
  student:
    'Sign in with your email and password, or with Google or your mobile number.',
  college:
    'Use the email and password your college account was set up with. New college accounts are created by the platform team.',
  coaching:
    'Use the email and password your centre account was set up with. New centre accounts are created by the platform team.',
  admin: 'Platform staff only. Your account already carries the admin role.',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const { role: currentRole, loading: roleLoading } = useRole();
  const [error, setError] = useState('');
  const [routing, setRouting] = useState(false);
  const [wrongPortal, setWrongPortal] = useState<Role | null>(null);

  const next = params.get('next');
  const picked = params.get('portal');
  const portal: Role = isRole(picked) ? picked : 'student';
  // useIdleLogout lands here after two hours of no interaction. Say so, or
  // being bounced to sign-in mid-task looks like a fault.
  const timedOut = params.get('timeout') === '1';
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

  /**
   * Where to go once somebody is signed in, whichever way they did it.
   *
   * Split out of route() so the password form can reach it too: that path has
   * no Firebase user to read a claim from, but the decision afterwards - right
   * portal, wrong portal, or finish signing up - is identical.
   */
  async function routeToRole(role: Role | null) {
    setRouting(true);
    // Hand the server a credential of its own, so the portal page they are
    // about to land on can render with its data already in it.
    await startServerSession();
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

  async function route(signedIn: User) {
    setRouting(true);
    await routeToRole(await syncSessionCookie(signedIn));
  }

  // Already signed in? Do not make them do it twice.
  useEffect(() => {
    if (!loading && user && !routing) void route(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Whether they were *already* signed in when this page opened, as opposed to
  // signing in on it just now. Only the first answer counts: signing in here
  // must still reach route() above, which is what reports a wrong-portal
  // mismatch instead of silently landing them somewhere they did not choose.
  const arrivedSignedIn = useRef<boolean | null>(null);
  if (!roleLoading && arrivedSignedIn.current === null) {
    arrivedSignedIn.current = currentRole !== null;
  }
  // proxy.ts turns most of these away at the edge, but its cookie lasts an
  // hour while a session lasts longer, and a dev-token session never reaches
  // useAuth at all. This catches both. `next` and dev mode are exempt for the
  // same reasons the edge guard exempts them.
  const bouncing = Boolean(
    arrivedSignedIn.current && currentRole && !next && !isDevModeForced(),
  );

  useEffect(() => {
    if (bouncing && currentRole) router.replace(PORTAL_HOME[currentRole]);
  }, [bouncing, currentRole, router]);

  if (loading || routing || roleLoading || bouncing) {
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
      {timedOut && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-subtle)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-primary)]"
        >
          You were signed out after 2 hours of inactivity. Sign in to pick up where you
          left off.
        </p>
      )}

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

      {/* Email and password, for every portal. The only method that works
          without Firebase, and the only one staff accounts have at all. */}
      <PasswordForm onSuccess={routeToRole} onError={setError} />

      {devBypass === null ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <span className="sr-only">Loading sign-in</span>
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* Phone and Google sit alongside the password, not instead of it,
              and only for students - staff accounts have neither. They need a
              configured Firebase project, so they are hidden when the backend
              reports dev mode rather than rendering forms that can only fail. */}
          {portal === 'student' && !devBypass && (
            <>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="h-px flex-1 bg-[var(--line)]" />
                or
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>

              <PhoneOTPForm onSuccess={route} onError={setError} />

              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="h-px flex-1 bg-[var(--line)]" />
                or
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>

              <GoogleSignIn onSuccess={route} onError={setError} />
            </>
          )}

          {/* The dev bypass is still here, just no longer the only way in.
              Collapsed, because on a laptop with no Firebase keys the password
              form above is now the realistic path. */}
          {devBypass && (
            <details className="rounded-lg border border-[var(--line)] px-3 py-2">
              <summary className="cursor-pointer text-[13px] text-[var(--text-secondary)]">
                Developer sign-in
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {portal === 'student' ? (
                  <DevOTPForm
                    onSuccess={() =>
                      void router.replace(next ?? '/student/dashboard?welcome=1')
                    }
                    onError={setError}
                  />
                ) : (
                  <DevSignIn />
                )}
              </div>
            </details>
          )}
        </>
      )}

      {/* Signup is a student-only door. Staff accounts are created by an admin
          and arrive as a set-password link, so there is nothing to offer here
          for the other three portals. */}
      {portal === 'student' && (
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          New here?{' '}
          <Link href="/signup" className="font-medium underline">
            Create a student account
          </Link>
          .
        </p>
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
            Students can create an account from the sign-in screen. College and
            coaching accounts are created by the platform team, which sends a link
            to set your password.
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
