/**
 * The name of the httpOnly cookie holding a Firebase session cookie.
 *
 * Set on the Next.js origin, never on the API's. The browser therefore never
 * attaches it to a FastAPI request by itself: the only thing that can present
 * it is this app's own server, forwarding it in an explicit X-Session-Cookie
 * header. That is what makes the server-rendering path free of cross-site
 * request forgery by construction rather than by a token we have to keep
 * checking - there is no ambient credential for another site to ride.
 *
 * Distinct from ROLE_COOKIE in lib/portals, which is a readable routing hint
 * and proves nothing. This one is proof, and script can never read it.
 */
export const SESSION_COOKIE = 'edee_session';

/** Header the Next server uses to present the cookie to FastAPI. */
export const SESSION_HEADER = 'X-Session-Cookie';
