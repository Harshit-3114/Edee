import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Firebase needs real config to initialise, and none of these tests should be
// talking to it. Stubbing the env keeps lib/firebase importable.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:test';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';

const authStub = { currentUser: null };

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: () => ({}),
  getFirebaseAuth: () => authStub,
  tryGetFirebaseAuth: () => authStub,
  getGoogleProvider: () => ({}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
