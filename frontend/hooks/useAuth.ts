'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { tryGetFirebaseAuth } from '@/lib/firebase';
import { clearDevToken, getDevToken } from '@/lib/devSession';
import { clearSessionCookie } from '@/lib/session';
import { endServerSession } from '@/lib/clientSession';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = tryGetFirebaseAuth();
    if (!auth) {
      // Firebase is not configured. Treat it as signed out rather than hanging
      // on a loading state forever.
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  async function signOut() {
    // Before dropping the local credential, while it can still authenticate
    // the revoke call upstream.
    await endServerSession();
    const auth = tryGetFirebaseAuth();
    if (auth) await fbSignOut(auth);
    // A mock identity's rows die with its session: in dev mode the backend
    // deletes whatever the dev token created. Skipped without a dev token,
    // so real sessions never pay for a request that would 404 anyway.
    if (getDevToken()) {
      try {
        const { default: api } = await import('@/lib/api');
        await api.delete('/dev/mock-user');
      } catch {
        /* the rows are also swept at server shutdown */
      }
    }
    clearDevToken();
    clearSessionCookie();
    // Whatever this account read stays in memory until it is dropped, and the
    // next sign-in happens in the same tab.
    //
    // Imported here rather than at the top of the file on purpose: this module
    // reaches the public pages through the header's account menu, and a static
    // import would pull the API client - and axios with it - onto every
    // marketing page to serve a function only a signed-in user ever calls.
    const { clearApiCache } = await import('@/lib/apiCache');
    clearApiCache();
  }

  return { user, loading, signOut };
}
