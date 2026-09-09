import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
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

  it('leaves public paths alone', () => {
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
