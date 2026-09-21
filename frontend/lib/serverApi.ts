import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_HEADER } from './sessionCookie';

/**
 * Reads the API as the signed-in user, from a server component.
 *
 * This is the half of the platform that did not exist before. The browser's
 * Firebase ID token lives in IndexedDB, so a React Server Component - which
 * runs before any JavaScript does - could never fetch anything on the user's
 * behalf. Every portal page had to render empty and fill itself in after
 * hydration, which is the skeleton chain users watch.
 *
 * With the session cookie there is finally a credential the server can read,
 * so a page can arrive with its data already in it.
 *
 * `server-only` at the top is load-bearing: it makes importing this from a
 * client component a build error rather than a way to leak the session cookie
 * into the browser bundle.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** The session cookie for this request, or null when nobody is signed in. */
export async function sessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * GET `path` as the current user, or null if that is not possible.
 *
 * Null on every failure, deliberately, and never a throw. This is an
 * optimisation layered over a client fetch that already works: no session
 * cookie yet, a lapsed one, a 404 for a profile that does not exist, an API
 * that is down - each means "the server could not pre-fill this", and the
 * client component then loads it exactly as it did before, surfacing the real
 * error through the error state it already has.
 *
 * Throwing instead would let a server render turn a page that used to show a
 * retryable message into an error boundary, which is strictly worse than the
 * behaviour being replaced.
 */
export async function serverGet<T>(path: string): Promise<T | null> {
  const session = await sessionCookie();
  if (!session) return null;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { [SESSION_HEADER]: session },
      // Per-user data: never hand this to a shared cache.
      cache: 'no-store',
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * GET a PUBLIC endpoint from the server, with no credential at all.
 *
 * Separate from serverGet so the distinction is visible at the call site: this
 * one is for pages a logged-out visitor can see, and its result is the same
 * for everybody. That is what makes it safe to render into HTML the CDN holds
 * - which serverGet's output never is.
 *
 * Same fail-soft contract: null on any failure, and the client half loads it.
 */
export async function publicGet<T>(path: string, revalidateSeconds = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      // Shared, not per-user: let the server reuse it briefly rather than
      // hitting the API once per visitor.
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
