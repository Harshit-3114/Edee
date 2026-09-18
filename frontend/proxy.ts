import { NextResponse, type NextRequest } from 'next/server';
import { isDevModeForced } from '@/lib/devSession';
import { PORTAL_HOME, ROLE_COOKIE, isPublicPath, isRole, roleForPath } from '@/lib/portals';

/**
 * Edge role gate.
 *
 * Stops the wrong portal being fetched at all, so a college staff member never
 * sees the admin shell flash on screen. It reads a cookie the client wrote, so
 * it is a routing decision, not an authorisation one - the API behind every
 * screen still verifies the Firebase JWT.
 */
/** Screens whose only job is to get you signed in. Pointless once you are. */
const AUTH_PATHS = new Set(['/login', '/signup']);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get(ROLE_COOKIE)?.value;
  const role = isRole(cookie) ? cookie : null;

  // Already signed in? Sign-in and sign-up have nothing left to offer, so send
  // them to their own portal instead of showing a form they cannot use.
  //
  // Two exceptions. A `next` param means something deliberately routed them
  // here - RoleGate on a stale cookie, say - and bouncing that back would loop
  // between the two guards forever, so let the page load and decide. And
  // NEXT_PUBLIC_DEV_MODE=1 keeps both screens reachable: the dev sign-in panel
  // lives on /login, and switching roles there is the whole point of dev mode.
  if (
    AUTH_PATHS.has(pathname) &&
    role &&
    !req.nextUrl.searchParams.has('next') &&
    !isDevModeForced()
  ) {
    const home = req.nextUrl.clone();
    home.pathname = PORTAL_HOME[role];
    home.search = '';
    return NextResponse.redirect(home);
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const required = roleForPath(pathname);
  if (!required) return NextResponse.next();

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
    '/login',
    '/signup',
    '/student/:path*',
    '/college/:path*',
    '/coaching/:path*',
    '/admin/:path*',
  ],
};
