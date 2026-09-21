import { ROLE_COOKIE, isRole, type Role } from './portals';

const DEV_TOKEN_KEY = 'edee_dev_token';
const DEV_EVENT = 'edee-dev-session';

export interface DevClaims {
  uid: string;
  role: Role;
  collegeId: string | null;
  coachingCentreId: string | null;
}

/**
 * Parse a dev: token. Mirrors backend app/core/devmode.py — keep the two in
 * sync. Dev tokens are self-described bearer strings for local development
 * only (dev:student[:tag], dev:admin[:tag], dev:college:<id>,
 * dev:coaching:<id>); the backend accepts them solely in dev mode.
 */
export function parseDevToken(token: string): DevClaims | null {
  if (!token.startsWith('dev:')) return null;
  const [, role, ...rest] = token.split(':');
  if (!isRole(role)) return null;
  const scope = rest.join(':');
  if ((role === 'college' || role === 'coaching') && !scope) return null;
  return {
    uid: token,
    role,
    collegeId: role === 'college' ? scope : null,
    coachingCentreId: role === 'coaching' ? scope : null,
  };
}

export function getDevToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(DEV_TOKEN_KEY);
}

function notifyDevSessionChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEV_EVENT));
}

/** Subscribe to dev sign-in/out so role state refreshes without a reload. */
export function onDevSessionChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DEV_EVENT, listener);
  return () => window.removeEventListener(DEV_EVENT, listener);
}

function writeRoleCookie(role: Role): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ROLE_COOKIE}=${role}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
}

function clearRoleCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setDevToken(token: string): DevClaims | null {
  const claims = parseDevToken(token);
  if (!claims || typeof window === 'undefined') return null;
  window.localStorage.setItem(DEV_TOKEN_KEY, token);
  writeRoleCookie(claims.role);
  notifyDevSessionChanged();
  return claims;
}

export function clearDevToken(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(DEV_TOKEN_KEY);
  clearRoleCookie();
  notifyDevSessionChanged();
}

/**
 * Explicit override: NEXT_PUBLIC_DEV_MODE=1 forces the developer sign-in
 * panel, even with Firebase configured. The backend still decides what it
 * accepts — pair this with backend DEV_MODE=1 (or no Firebase keys there).
 * Never set either against a production backend.
 */
export function isDevModeForced(): boolean {
  return process.env.NEXT_PUBLIC_DEV_MODE === '1';
}

/**
 * Ask the backend whether it runs in dev mode. GET /health is public and
 * carries a dev_mode flag for exactly this. Short timeout: an unreachable
 * backend answers the question by itself (not dev mode we can use).
 */
export async function fetchBackendDevMode(): Promise<boolean> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${base}/health`, { signal: controller.signal });
      if (!res.ok) return false;
      const body = (await res.json()) as { dev_mode?: unknown };
      return body.dev_mode === true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
