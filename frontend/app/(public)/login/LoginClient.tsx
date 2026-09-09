'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { User } from 'firebase/auth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import PhoneOTPForm from '@/components/auth/PhoneOTPForm';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { PORTAL_HOME, roleForPath } from '@/lib/portals';
import { syncSessionCookie } from '@/lib/session';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [routing, setRouting] = useState(false);

  async function route(signedIn: User) {
    setRouting(true);
    const role = await syncSessionCookie(signedIn);

    if (!role) {
      // A Firebase account with no role claim is a student who has not
      // finished signing up. Staff accounts always arrive with a claim.
      router.replace('/signup');
      return;
    }

    // Honour ?next= only when the path belongs to this user's own portal.
    const next = params.get('next');
    if (next && roleForPath(next) === role) {
      router.replace(next);
      return;
    }
    router.replace(PORTAL_HOME[role]);
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
      <PhoneOTPForm onSuccess={route} onError={setError} />

      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        or
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <GoogleSignIn onSuccess={route} onError={setError} />

      {error && <ErrorState message={error} />}
    </>
  );
}

export default function LoginClient() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-6 py-12"
    >
      <div>
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Sahayak
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          Students, colleges, coaching centres and platform staff all sign in here. You
          land in the right place automatically.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <LoginForm />
      </Suspense>

      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
        New here? Signing in with your mobile number creates your student account.
        College and coaching accounts are created by the platform team.
      </p>
    </main>
  );
}
