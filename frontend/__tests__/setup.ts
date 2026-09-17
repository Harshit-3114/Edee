import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Polyfill IntersectionObserver for jsdom
class IntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe = vi.fn((element: Element) => {
    // Immediately report as intersecting
    this.callback([{ isIntersecting: true, target: element } as IntersectionObserverEntry], this);
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn();
  thresholds = [];
  root = null;
  rootMargin = '';
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
  }
}
global.IntersectionObserver = IntersectionObserver;

// Polyfill ResizeObserver for jsdom
class ResizeObserver {
  callback: ResizeObserverCallback;
  observe = vi.fn((element: Element) => {
    // Immediately report a size
    const entry: ResizeObserverEntry = {
      target: element,
      contentRect: {
        x: 0,
        y: 0,
        width: element.clientWidth || 300,
        height: element.clientHeight || 200,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        toJSON: () => ({}),
      },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    };
    this.callback([entry], this);
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
}
global.ResizeObserver = ResizeObserver;

// Polyfill window.matchMedia
window.matchMedia = window.matchMedia || function (query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
};

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
