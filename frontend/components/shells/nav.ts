import type { Role } from '@/lib/portals';

export interface NavItem {
  href: string;
  label: string;
}

/**
 * The only thing that differs between the four shells. Keeping it here means
 * PortalShell has one implementation and no per-portal branching.
 */
export const PORTAL_NAV: Record<Role, NavItem[]> = {
  student: [
    { href: '/student/dashboard', label: 'Applications' },
    { href: '/student/colleges', label: 'Find colleges' },
    { href: '/student/shortlist', label: 'Shortlist' },
    { href: '/student/profile', label: 'Profile' },
  ],
  college: [
    { href: '/college/dashboard', label: 'Overview' },
    { href: '/college/courses', label: 'Courses' },
    { href: '/college/applications', label: 'Applications' },
    { href: '/college/profile', label: 'College profile' },
  ],
  coaching: [
    { href: '/coaching/dashboard', label: 'Overview' },
    { href: '/coaching/students', label: 'My students' },
    { href: '/coaching/invite', label: 'Invite codes' },
    { href: '/coaching/profile', label: 'Centre profile' },
  ],
  admin: [
    { href: '/admin/dashboard', label: 'Overview' },
    { href: '/admin/colleges', label: 'Colleges' },
    { href: '/admin/coaching', label: 'Coaching centres' },
    { href: '/admin/students', label: 'Students' },
    { href: '/admin/users', label: 'Users and roles' },
    { href: '/admin/payments', label: 'Payments' },
    { href: '/admin/audit', label: 'Audit log' },
    { href: '/admin/inbox', label: 'Inbox' },
    { href: '/admin/apis', label: 'API status' },
  ],
};
