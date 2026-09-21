import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDevToken,
  fetchBackendDevMode,
  getDevToken,
  isDevModeForced,
  parseDevToken,
  setDevToken,
} from '@/lib/devSession';
import { ROLE_COOKIE } from '@/lib/portals';

describe('parseDevToken', () => {
  it('accepts every role, with an optional tag for people without a scope', () => {
    expect(parseDevToken('dev:student')).toMatchObject({ role: 'student' });
    expect(parseDevToken('dev:student:alice')).toMatchObject({
      uid: 'dev:student:alice',
      role: 'student',
    });
    expect(parseDevToken('dev:admin')).toMatchObject({ role: 'admin' });
  });

  it('requires a scope for staff roles and files it on the claim', () => {
    const college = parseDevToken('dev:college:11111111-1111-1111-1111-111111111111');
    expect(college).toMatchObject({
      role: 'college',
      collegeId: '11111111-1111-1111-1111-111111111111',
      coachingCentreId: null,
    });
    expect(parseDevToken('dev:college')).toBeNull();
    expect(parseDevToken('dev:coaching')).toBeNull();
  });

  it('rejects everything that is not a dev token', () => {
    for (const bad of ['', 'bogus', 'dev:', 'dev:superuser', 'dev:phone:9876543210', 'eyJhbGciOiJ9.e30.sig']) {
      expect(parseDevToken(bad)).toBeNull();
    }
  });
});

describe('dev token storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0`;
  });

  it('round-trips a token and mirrors the role into the routing cookie', () => {
    const claims = setDevToken('dev:coaching:22222222-2222-2222-2222-222222222222');
    expect(claims).toMatchObject({ role: 'coaching' });
    expect(getDevToken()).toBe('dev:coaching:22222222-2222-2222-2222-222222222222');
    expect(document.cookie).toContain(`${ROLE_COOKIE}=coaching`);
  });

  it('refuses to store a malformed token', () => {
    expect(setDevToken('bogus')).toBeNull();
    expect(getDevToken()).toBeNull();
  });

  it('clearing removes both the token and the cookie', () => {
    setDevToken('dev:student');
    clearDevToken();
    expect(getDevToken()).toBeNull();
    expect(document.cookie).not.toContain(`${ROLE_COOKIE}=student`);
  });
});

describe('dev mode detection', () => {
  it('reads the explicit frontend flag', () => {
    expect(isDevModeForced()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_DEV_MODE', '1');
    // Module reads env at call time, so no re-import dance is needed.
    expect(isDevModeForced()).toBe(true);
    vi.unstubAllEnvs();
  });

  it('treats an unreachable backend as not dev mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    try {
      await expect(fetchBackendDevMode()).resolves.toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('trusts the backend health flag when reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ dev_mode: true }) }),
    );
    try {
      await expect(fetchBackendDevMode()).resolves.toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
