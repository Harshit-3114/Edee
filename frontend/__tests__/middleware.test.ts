import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy as middleware } from '@/proxy';
import { ROLE_COOKIE } from '@/lib/portals';

function request(path: string, role?: string) {
  const req = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (role) req.cookies.set(ROLE_COOKIE, role);
  return req;
}

function redirectTarget(path: string, role?: string) {
  const location = middleware(request(path, role)).headers.get('location');
  return location ? new URL(location) : null;
}

describe('middleware', () => {
  it('sends an anonymous visitor to login and remembers where they were going', () => {
    const target = redirectTarget('/admin/users');
    expect(target?.pathname).toBe('/login');
    expect(target?.searchParams.get('next')).toBe('/admin/users');
  });

  it('bounces a college user out of the admin portal, into their own', () => {
    expect(redirectTarget('/admin/users', 'college')?.pathname).toBe('/college/dashboard');
  });

  it('bounces a student out of the college portal', () => {
    expect(redirectTarget('/college/courses', 'student')?.pathname).toBe(
      '/student/dashboard',
    );
  });

  it('lets each role through its own portal', () => {
    expect(redirectTarget('/college/courses', 'college')).toBeNull();
    expect(redirectTarget('/student/shortlist', 'student')).toBeNull();
    expect(redirectTarget('/coaching/students', 'coaching')).toBeNull();
    expect(redirectTarget('/admin/audit', 'admin')).toBeNull();
  });

  it('leaves public paths alone for a visitor who is not signed in', () => {
    expect(redirectTarget('/login')).toBeNull();
    expect(redirectTarget('/')).toBeNull();
    expect(redirectTarget('/signup')).toBeNull();
  });

  it('treats a junk cookie value as no role at all', () => {
    // A forged cookie must not be able to invent a fifth role and slip past.
    expect(redirectTarget('/admin/users', 'superuser')?.pathname).toBe('/login');
  });

  it('drops any existing query when redirecting to a portal home', () => {
    const target = redirectTarget('/admin/users?tab=secret', 'coaching');
    expect(target?.pathname).toBe('/coaching/dashboard');
    expect(target?.search).toBe('');
  });
});

describe('middleware: signed-in users and the sign-in screens', () => {
  it.each(['/login', '/signup'])('turns a signed-in student away from %s', (path) => {
    expect(redirectTarget(path, 'student')?.pathname).toBe('/student/dashboard');
  });

  it.each([
    ['college', '/college/dashboard'],
    ['coaching', '/coaching/dashboard'],
    ['admin', '/admin/dashboard'],
  ])('sends a signed-in %s to their own portal, not the student one', (role, home) => {
    expect(redirectTarget('/login', role)?.pathname).toBe(home);
    expect(redirectTarget('/signup', role)?.pathname).toBe(home);
  });

  it('keeps the portal picker reachable for someone who is not signed in', () => {
    expect(redirectTarget('/login?portal=college')).toBeNull();
    expect(redirectTarget('/signup')).toBeNull();
  });

  it('turns a signed-in user away even when they picked a portal tab', () => {
    expect(redirectTarget('/login?portal=college', 'student')?.pathname).toBe(
      '/student/dashboard',
    );
  });

  it('drops the query when bouncing off a sign-in screen', () => {
    expect(redirectTarget('/login?portal=admin', 'student')?.search).toBe('');
  });

  it('stands aside when a `next` param says something routed them here', () => {
    // RoleGate sends a stale-cookie session to /login?next=... . Bouncing that
    // back to the portal would put the two guards in an endless loop.
    expect(redirectTarget('/login?next=/student/shortlist', 'student')).toBeNull();
  });

  it('is not fooled by a forged role cookie', () => {
    expect(redirectTarget('/login', 'superuser')).toBeNull();
  });
});

describe('middleware: dev mode keeps the sign-in screens reachable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['/login', '/signup'])('leaves %s alone when NEXT_PUBLIC_DEV_MODE=1', (path) => {
    vi.stubEnv('NEXT_PUBLIC_DEV_MODE', '1');
    // The dev sign-in panel lives on /login; switching roles is the point.
    expect(redirectTarget(path, 'student')).toBeNull();
    expect(redirectTarget(path, 'admin')).toBeNull();
  });

  it('still guards the portals themselves in dev mode', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_MODE', '1');
    expect(redirectTarget('/admin/users', 'college')?.pathname).toBe('/college/dashboard');
    expect(redirectTarget('/admin/users')?.pathname).toBe('/login');
  });

  it('bounces again as soon as dev mode is off', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_MODE', '0');
    expect(redirectTarget('/login', 'student')?.pathname).toBe('/student/dashboard');
  });
});
