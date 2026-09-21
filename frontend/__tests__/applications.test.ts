import { describe, expect, it } from 'vitest';
import { NEXT_STATUS, canTransition, isTerminal } from '@/lib/applications';
import type { ApplicationStatus } from '@/lib/types';

const ALL: ApplicationStatus[] = [
  'payment_received',
  'under_review',
  'accepted',
  'rejected',
  'withdrawn',
];

describe('application status transitions', () => {
  it('moves a paid application into review, and nowhere else', () => {
    expect(NEXT_STATUS.payment_received).toEqual(['under_review']);
    expect(canTransition('payment_received', 'accepted')).toBe(false);
  });

  it('decides only from under review', () => {
    expect(canTransition('under_review', 'accepted')).toBe(true);
    expect(canTransition('under_review', 'rejected')).toBe(true);
  });

  it('never lets a college withdraw an application', () => {
    // Withdrawal belongs to the student. If this ever passes, the college
    // portal has been handed a decision that is not its own.
    for (const from of ALL) {
      expect(canTransition(from, 'withdrawn')).toBe(false);
    }
  });

  it('treats a decided application as closed', () => {
    expect(isTerminal('accepted')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('withdrawn')).toBe(true);
    expect(isTerminal('payment_received')).toBe(false);
    expect(isTerminal('under_review')).toBe(false);
  });

  it('cannot reopen a decision', () => {
    expect(NEXT_STATUS.accepted).toEqual([]);
    expect(NEXT_STATUS.rejected).toEqual([]);
  });

  it('has an entry for every status the API can return', () => {
    for (const status of ALL) {
      expect(NEXT_STATUS[status]).toBeDefined();
    }
  });
});
