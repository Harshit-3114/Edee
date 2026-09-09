import { describe, expect, it } from 'vitest';
import {
  formatFee,
  formatPhone,
  isValidIndianMobile,
  pluralise,
  sumFees,
  toE164,
} from '@/lib/format';

describe('money', () => {
  it('renders paise as whole rupees', () => {
    // 150000 paise is 1,500 rupees. Getting this wrong by 100x is the kind of
    // bug that only shows up on a real payment screen.
    expect(formatFee(150000)).toContain('1,500');
    expect(formatFee(0)).toContain('0');
  });

  it('adds fees without floating point drift', () => {
    expect(sumFees([150000, 75050, 99999])).toBe(325049);
    expect(sumFees([])).toBe(0);
  });
});

describe('phone numbers', () => {
  it('accepts valid Indian mobiles and rejects the rest', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true);
    expect(isValidIndianMobile('98765 43210')).toBe(true);
    expect(isValidIndianMobile('+919876543210')).toBe(true);
    expect(isValidIndianMobile('1234567890')).toBe(false);
    expect(isValidIndianMobile('98765')).toBe(false);
  });

  it('normalises to E.164 for Firebase', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
    expect(toE164('919876543210')).toBe('+919876543210');
    expect(toE164('+919876543210')).toBe('+919876543210');
  });

  it('groups a number the way it is read aloud', () => {
    expect(formatPhone('9876543210')).toBe('98765 43210');
    expect(formatPhone('not a number')).toBe('not a number');
  });
});

describe('pluralise', () => {
  it('switches on one', () => {
    expect(pluralise(1, 'application', 'applications')).toBe('1 application');
    expect(pluralise(0, 'application', 'applications')).toBe('0 applications');
    expect(pluralise(3, 'application', 'applications')).toBe('3 applications');
  });
});
