'use client';

import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { tryGetFirebaseAuth } from '@/lib/firebase';
import { getDevToken, onDevSessionChanged, parseDevToken } from '@/lib/devSession';
import { isRole, type Role } from '@/lib/portals';

interface RoleState {
  role: Role | null;
  collegeId: string | null;
  coachingCentreId: string | null;
  loading: boolean;
}

const EMPTY: Omit<RoleState, 'loading'> = {
  role: null,
  collegeId: null,
  coachingCentreId: null,
};

/** Identity from a stored dev token, if any. No Firebase involved. */
function devState(): Omit<RoleState, 'loading'> {
  const token = getDevToken();
  const claims = token ? parseDevToken(token) : null;
  if (!claims) return { ...EMPTY };
  return {
    role: claims.role,
    collegeId: claims.collegeId,
    coachingCentreId: claims.coachingCentreId,
  };
}

/**
 * Reads the role from the decoded Firebase token, not from the cookie.
 *
 * onIdTokenChanged rather than onAuthStateChanged: it also fires on token
 * refresh, so a role granted in the admin portal reaches an open tab without
 * a reload.
 */
export function useRole(): RoleState {
  const [state, setState] = useState<RoleState>({ ...EMPTY, loading: true });

  useEffect(() => {
    const auth = tryGetFirebaseAuth();
    if (!auth) {
      // No Firebase configured: a stored dev token (if any) is the identity.
      // Re-sync when dev sign-in/out happens elsewhere on the page.
      const syncDev = () => {
        setState({ ...devState(), loading: false });
      };
      syncDev();
      return onDevSessionChanged(syncDev);
    }

    const stopDevSync = onDevSessionChanged(() => {
      // A dev sign-in/out happened elsewhere. A signed-in Firebase user keeps
      // winning; otherwise fall back to whatever dev token is stored now.
      if (!auth.currentUser) setState({ ...devState(), loading: false });
    });

    const stopAuth = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        // Signed out of Firebase: fall back to a dev token if one is stored.
        setState({ ...devState(), loading: false });
        return;
      }
      try {
        const { claims } = await user.getIdTokenResult();
        setState({
          role: isRole(claims.role) ? claims.role : null,
          collegeId: typeof claims.college_id === 'string' ? claims.college_id : null,
          coachingCentreId:
            typeof claims.coaching_centre_id === 'string'
              ? claims.coaching_centre_id
              : null,
          loading: false,
        });
      } catch {
        setState({ ...EMPTY, loading: false });
      }
    });

    return () => {
      stopDevSync();
      stopAuth();
    };
  }, []);

  return state;
}
