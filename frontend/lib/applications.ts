import type { ApplicationStatus } from './types';

/**
 * Which statuses a college may move an application to, from where.
 *
 * Mirrors the check constraint on the applications table. Kept here rather than
 * in a component so the list view and the detail view cannot drift apart and
 * offer different transitions for the same row.
 *
 * `withdrawn` is reachable only by the student, so it is never an option here.
 */
export const NEXT_STATUS: Record<ApplicationStatus, ApplicationStatus[]> = {
  payment_received: ['under_review'],
  under_review: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return NEXT_STATUS[from].includes(to);
}

/** True once no further college-side transition is possible. */
export function isTerminal(status: ApplicationStatus): boolean {
  return NEXT_STATUS[status].length === 0;
}
