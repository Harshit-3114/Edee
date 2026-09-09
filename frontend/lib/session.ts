import type { User } from 'firebase/auth';
import { ROLE_COOKIE, isRole, type Role } from './portals';

/**
 * Mirrors the role claim into a cookie so middleware.ts can read it at the edge.
 *
 * This cookie cannot be httpOnly - the client writes it. Treat it as a routing
 * hint and nothing more. Every screen behind it still calls an API that verifies
 * the Firebase JWT server-side, so a forged cookie buys a rendered shell and a
 * wall of 403s.
 */
export async function syncSessionCookie(user: User | null): Promise<Role | null> {
  if (typeof document === 'undefined') return null;

  if (!user) {
    document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return null;
  }

  // Force a refresh so a role assigned seconds ago in the admin portal is seen.
  const { claims } = await user.getIdTokenResult(true);
  const role = isRole(claims.role) ? claims.role : null;

  if (role) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${ROLE_COOKIE}=${role}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }

  return role;
}

export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
