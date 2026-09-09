import { NextResponse, type NextRequest } from 'next/server';
import { PORTAL_HOME, ROLE_COOKIE, isPublicPath, isRole, roleForPath } from '@/lib/portals';

/**
 * Edge role gate.
 *
 * Stops the wrong portal being fetched at all, so a college staff member never
 * sees the admin shell flash on screen. It reads a cookie the client wrote, so
 * it is a routing decision, not an authorisation one - the API behind every
 * screen still verifies the Firebase JWT.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const required = roleForPath(pathname);
  if (!required) return NextResponse.next();

  const cookie = req.cookies.get(ROLE_COOKIE)?.value;
  const role = isRole(cookie) ? cookie : null;

  if (!role) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  if (role !== required) {
    // Signed in, wrong portal. Send them to their own rather than a 404 - a
    // 404 would leave them wondering whether the page exists.
    const home = req.nextUrl.clone();
    home.pathname = PORTAL_HOME[role];
    home.search = '';
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/student/:path*',
    '/college/:path*',
    '/coaching/:path*',
    '/admin/:path*',
  ],
};
