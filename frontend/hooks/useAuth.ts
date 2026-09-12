'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { tryGetFirebaseAuth } from '@/lib/firebase';
import { clearDevToken } from '@/lib/devSession';
import { clearSessionCookie } from '@/lib/session';

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
    const auth = tryGetFirebaseAuth();
    if (auth) await fbSignOut(auth);
    clearDevToken();
    clearSessionCookie();
  }

  return { user, loading, signOut };
}
