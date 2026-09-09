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
 * /signup is here because it needs a Firebase account but not yet a role - it
 * is the screen where a new student earns one. The page redirects to /login
 * itself if nobody is signed in.
 */
export const PUBLIC_PATHS: readonly string[] = [
  '/',
  '/login',
  '/signup',
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
