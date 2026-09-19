import type { ApplicationStatus, CohortStage } from './types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Fees travel over the wire in paise, because floats and money do not mix.
 * Every rupee shown to a user goes through here.
 */
export function formatFee(paise: number): string {
  return inr.format(Math.round(paise) / 100);
}

export function sumFees(paise: number[]): number {
  return paise.reduce((total, amount) => total + amount, 0);
}

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFmt.format(date);
}

/** Indian mobile numbers, grouped the way people read them aloud. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10));
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  payment_received: 'Payment received',
  under_review: 'Under review',
  accepted: 'Accepted',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_STATUS_TONE: Record<
  ApplicationStatus,
  'neutral' | 'success' | 'danger' | 'warning' | 'action'
> = {
  payment_received: 'success',
  under_review: 'warning',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

export const COHORT_STAGE_LABEL: Record<CohortStage, string> = {
  signed_up: 'Signed up',
  shortlisted: 'Shortlisted',
  paid: 'Paid',
  accepted: 'Accepted',
};

export function pluralise(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Backend-served file paths (college logos) are relative (/uploads/…).
 * Prefix the API origin unless the value is already absolute.
 */
export function apiFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}
