import { describe, expect, it } from 'vitest';
import {
  PORTAL_HOME,
  PORTAL_PREFIX,
  ROLES,
  isPublicPath,
  isRole,
  resolvePostLoginDestination,
  roleForPath,
} from '@/lib/portals';

describe('portal routing', () => {
  it('maps each prefix to its owning role', () => {
    expect(roleForPath('/student/colleges')).toBe('student');
    expect(roleForPath('/college/applications/abc-123')).toBe('college');
    expect(roleForPath('/coaching/students')).toBe('coaching');
    expect(roleForPath('/admin/users')).toBe('admin');
  });

  it('matches a bare prefix as well as a nested path', () => {
    for (const role of ROLES) {
      expect(roleForPath(PORTAL_PREFIX[role])).toBe(role);
    }
  });

  it('does not let a lookalike prefix claim a portal', () => {
    // /students is not /student. A prefix match without the boundary check
    // would hand this to the student portal.
    expect(roleForPath('/students')).toBeNull();
    expect(roleForPath('/admin-tools')).toBeNull();
  });

  it('treats public paths as unowned', () => {
    expect(roleForPath('/login')).toBeNull();
    expect(roleForPath('/')).toBeNull();
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/signup')).toBe(true);
    expect(isPublicPath('/admin/users')).toBe(false);
  });

  it('sends every role to a home inside its own portal', () => {
    for (const role of ROLES) {
      expect(roleForPath(PORTAL_HOME[role])).toBe(role);
    }
  });

  it('recognises only the four real roles', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('superuser')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe('resolvePostLoginDestination', () => {
  it('sends a request without a role to signup', () => {
    expect(resolvePostLoginDestination(null, 'student', null)).toEqual({ kind: 'signup' });
  });

  it('honours a matching portal pick and a valid next path', () => {
    expect(resolvePostLoginDestination('college', 'college', '/college/dashboard')).toEqual({
      kind: 'go',
      path: '/college/dashboard',
    });
  });

  it('falls back to the portal home when next points elsewhere', () => {
    expect(resolvePostLoginDestination('student', 'student', '/admin/users')).toEqual({
      kind: 'go',
      path: PORTAL_HOME.student,
    });
  });

  it('flags a mismatch instead of silently landing elsewhere', () => {
    expect(resolvePostLoginDestination('college', 'student', null)).toEqual({
      kind: 'mismatch',
      actual: 'college',
    });
  });
});
