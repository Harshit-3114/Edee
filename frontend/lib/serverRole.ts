import 'server-only';

import { isRole, type Role } from './portals';
import { serverGet } from './serverApi';

interface Me {
  uid: string;
  role: string | null;
  college_id: string | null;
  coaching_centre_id: string | null;
}

/**
 * The role behind this request's session cookie, verified by the API.
 *
 * Null when there is no session, when it has lapsed, or when the API cannot be
 * reached - every one of which just means the client-side gate decides, as it
 * always did. This never widens access: RoleGate still redirects on what the
 * verified token says, so the worst a wrong answer here can do is show the
 * shell for a moment before the client corrects it.
 */
export async function serverRole(): Promise<Role | null> {
  const me = await serverGet<Me>('/auth/me');
  return me && isRole(me.role) ? me.role : null;
}
