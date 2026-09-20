/**
 * The single source of truth for which role owns which part of the URL space.
 *
 * Every redirect in the app - middleware, RoleGate, login - reads this file.
 * Nothing anywhere else hardcodes a portal path. Adding a fifth portal means
 * editing this file and nothing else.
 */

export type Role = 'student' | 'college' | 'coaching' | 'admin';

export const ROLES: readonly Role[] = ['student', 'college', 'coaching', 'admin'];

/** Roles an admin can grant. Students sign themselves up. */
export const STAFF_ROLES: readonly Role[] = ['college', 'coaching', 'admin'];

/** URL prefix owned by each role. */
export const PORTAL_PREFIX: Record<Role, string> = {
  student: '/student',
  college: '/college',
  coaching: '/coaching',
  admin: '/admin',
};

/** Where a freshly authenticated user lands. */
export const PORTAL_HOME: Record<Role, string> = {
  student: '/student/dashboard',
  college: '/college/dashboard',
  coaching: '/coaching/dashboard',
  admin: '/admin/dashboard',
};

export const PORTAL_LABEL: Record<Role, string> = {
  student: 'Student',
  college: 'College',
  coaching: 'Coaching',
  admin: 'Admin',
};

/**
 * Paths the edge guard lets through untouched.
 *
 * /signup is here because it is where a new student earns a role and so cannot
 * require one. /set-password is the same for staff: the invite link is the only
 * credential its visitor has, and the account does not exist until they finish.
 */
export const PUBLIC_PATHS: readonly string[] = [
  '/',
  '/login',
  '/signup',
  '/set-password',
  '/unauthorised',
];

/** Name of the cookie middleware reads. A routing hint, never proof. */
export const ROLE_COOKIE = 'portal_role';

/** Which role owns this pathname, or null when it is public or unknown. */
export function roleForPath(pathname: string): Role | null {
  return (
    ROLES.find(
      (role) =>
        pathname === PORTAL_PREFIX[role] ||
        pathname.startsWith(`${PORTAL_PREFIX[role]}/`),
    ) ?? null
  );
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export type PostLoginAction =
  | { kind: 'signup' }
  | { kind: 'go'; path: string }
  | { kind: 'mismatch'; actual: Role };

/**
 * Decides where a freshly signed-in user goes.
 *
 * `portal` is the tab they picked on the sign-in page. When it disagrees with
 * the role on their verified token, say so instead of silently landing them
 * somewhere they did not ask for — that silent jump is what makes staff think
 * sign-in is broken.
 */
export function resolvePostLoginDestination(
  role: Role | null,
  portal: Role | null,
  next: string | null,
): PostLoginAction {
  if (!role) return { kind: 'signup' };
  if (portal && portal !== role) return { kind: 'mismatch', actual: role };
  if (next && roleForPath(next) === role) return { kind: 'go', path: next };
  return { kind: 'go', path: PORTAL_HOME[role] };
}
