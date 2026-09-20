'use client';

import { getDevToken } from './devSession';
import { getLocalToken } from './localSession';
import { tryGetFirebaseAuth } from './firebase';
import { logger } from './logger';

/**
 * Keeps the httpOnly session cookie in step with whoever is signed in.
 *
 * The cookie is what lets a server component render a page with the user's
 * data already in it. It can only be created from a credential that exists in
 * the browser, so this runs at exactly two moments: just after a sign-in, and
 * just before a sign-out.
 *
 * Every failure here is swallowed on purpose. The session cookie is an
 * optimisation - without it pages still fetch on the client exactly as they
 * did before - so a hiccup creating one must never block a sign-in.
 */

const SESSION_ENDPOINT = '/auth/session';

/** Exchange the current credential for a session cookie. */
export async function startServerSession(): Promise<void> {
  try {
    const user = tryGetFirebaseAuth()?.currentUser;
    // Email/password and dev sessions have no Firebase user. Their tokens are
    // their own credential, and POST /auth/session hands each one straight
    // back as the session rather than exchanging it for anything.
    const idToken = user
      ? await user.getIdToken()
      : (getLocalToken() ?? getDevToken());
    if (!idToken) return;

    await fetch(SESSION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (error) {
    logger.warn('Could not start a server session; pages will fetch client-side', error);
  }
}

/** Drop the session cookie and revoke it upstream. */
export async function endServerSession(): Promise<void> {
  try {
    await fetch(SESSION_ENDPOINT, { method: 'DELETE' });
  } catch (error) {
    logger.warn('Could not end the server session cleanly', error);
  }
}
