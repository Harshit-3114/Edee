import { ROLE_COOKIE, isRole, type Role } from './portals';

/**
 * Client-side half of the email/password sign-in path.
 *
 * Mirrors lib/devSession.ts, and for the same reason: there is no Firebase SDK
 * holding this identity, so the token has to live somewhere the app can read
 * it on the next render. It is kept in localStorage and announced on an event,
 * so a sign-in in one part of the page refreshes the rest without a reload.
 *
 * The claims here are DECODED, never verified. Anyone can edit what is in
 * their own localStorage; what stops that mattering is that the backend checks
 * the signature on every request. Treat everything this module returns as a
 * hint about what to render, never as permission to render it.
 */

const TOKEN_KEY = 'edee_local_token';
const EVENT = 'edee-local-session';
const PREFIX = 'edee1';

export interface LocalClaims {
  uid: string;
  role: Role;
  email: string | null;
  collegeId: string | null;
  coachingCentreId: string | null;
  /** Seconds since the epoch, as the backend wrote it. */
  expiresAt: number;
}

/** Decode the payload of an `edee1.` token. Mirrors app/core/local_token.py. */
export function parseLocalToken(token: string): LocalClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;

  try {
    // The backend strips base64url padding; atob insists on it.
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));

    if (!isRole(claims.role) || typeof claims.uid !== 'string') return null;
    if (typeof claims.exp !== 'number') return null;
    // An expired token is not a session. Reading it as one would render a
    // portal that every request behind it then 401s on.
    if (claims.exp * 1000 <= Date.now()) return null;

    return {
      uid: claims.uid,
      role: claims.role,
      email: typeof claims.email === 'string' ? claims.email : null,
      collegeId: typeof claims.college_id === 'string' ? claims.college_id : null,
      coachingCentreId:
        typeof claims.coaching_centre_id === 'string' ? claims.coaching_centre_id : null,
      expiresAt: claims.exp,
    };
  } catch {
    return null;
  }
}

/**
 * The stored token, or null.
 *
 * Clears an expired one on the way out, so a tab left open overnight starts
 * from signed-out rather than from a credential every request will reject.
 */
export function getLocalToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (parseLocalToken(token) === null) {
    window.localStorage.removeItem(TOKEN_KEY);
    clearRoleCookie();
    return null;
  }
  return token;
}

export function getLocalClaims(): LocalClaims | null {
  const token = getLocalToken();
  return token ? parseLocalToken(token) : null;
}

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/** Subscribe to local sign-in/out so role state refreshes without a reload. */
export function onLocalSessionChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** The routing hint proxy.ts reads at the edge. Never proof of anything. */
function writeRoleCookie(role: Role, expiresAt: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  document.cookie = `${ROLE_COOKIE}=${role}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearRoleCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setLocalToken(token: string): LocalClaims | null {
  const claims = parseLocalToken(token);
  if (!claims || typeof window === 'undefined') return null;
  window.localStorage.setItem(TOKEN_KEY, token);
  writeRoleCookie(claims.role, claims.expiresAt);
  notifyChanged();
  return claims;
}

export function clearLocalToken(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
  clearRoleCookie();
  notifyChanged();
}
