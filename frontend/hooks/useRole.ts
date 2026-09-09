'use client';

import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { tryGetFirebaseAuth } from '@/lib/firebase';
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
      setState({ ...EMPTY, loading: false });
      return;
    }

    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ ...EMPTY, loading: false });
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
  }, []);

  return state;
}
