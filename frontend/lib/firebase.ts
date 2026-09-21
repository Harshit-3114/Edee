import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

/**
 * Firebase is initialised lazily, on first use, and never at module scope.
 *
 * Two reasons. Next.js server-renders client components, so a `getAuth()` at
 * import time runs on the server, where there is no session to read and a bad
 * or missing key takes the whole route down with a 500. And a developer who
 * has not wired up Firebase yet should still be able to run the app and see
 * every screen, rather than hitting a stack trace on the first portal page.
 *
 * Call this from effects and event handlers - places that only run in the
 * browser. Never from the top level of a module.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when every value the SDK needs is actually present. */
export function isFirebaseConfigured(): boolean {
  return Object.values(config).every((value) => Boolean(value));
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Copy .env.local.example to .env.local and fill in the NEXT_PUBLIC_FIREBASE_* values.',
    );
  }
  cachedApp = getApps().length === 0 ? initializeApp(config) : getApp();
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

/** Returns null instead of throwing, for callers that can carry on without it. */
export function tryGetFirebaseAuth(): Auth | null {
  try {
    return getFirebaseAuth();
  } catch {
    return null;
  }
}

export function getGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
