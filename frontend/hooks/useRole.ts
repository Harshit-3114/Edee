'use client';

import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { tryGetFirebaseAuth } from '@/lib/firebase';
import { getDevToken, onDevSessionChanged, parseDevToken } from '@/lib/devSession';
import { getLocalClaims, onLocalSessionChanged } from '@/lib/localSession';
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

/**
 * Identity from a stored token, if any. No Firebase involved.
 *
 * An email/password session wins over a dev token: it is a real credential
 * the backend will accept in any environment, where a dev token only works on
 * a laptop with no Firebase keys.
 */
function localState(): Omit<RoleState, 'loading'> {
  const local = getLocalClaims();
  if (local) {
    return {
      role: local.role,
      collegeId: local.collegeId,
      coachingCentreId: local.coachingCentreId,
    };
  }
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
      // No Firebase configured - the common case until the key arrives. A
      // stored email/password or dev token is the identity. Re-sync when a
      // sign-in or sign-out happens elsewhere on the page.
      const sync = () => {
        setState({ ...localState(), loading: false });
      };
      sync();
      const stopLocal = onLocalSessionChanged(sync);
      const stopDev = onDevSessionChanged(sync);
      return () => {
        stopLocal();
        stopDev();
      };
    }

    const resync = () => {
      // A sign-in or sign-out happened elsewhere. A signed-in Firebase user
      // keeps winning; otherwise fall back to whatever token is stored now.
      if (!auth.currentUser) setState({ ...localState(), loading: false });
    };
    const stopLocalSync = onLocalSessionChanged(resync);
    const stopDevSync = onDevSessionChanged(resync);

    const stopAuth = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        // Signed out of Firebase: fall back to a stored token if there is one.
        setState({ ...localState(), loading: false });
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
      stopLocalSync();
      stopDevSync();
      stopAuth();
    };
  }, []);

  return state;
}
