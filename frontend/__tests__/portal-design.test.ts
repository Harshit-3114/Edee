import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(path: string) {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

describe('stitch portal design language', () => {
  it('brands the header with the real Edee logo', () => {
    const shell = src('components/shells/PortalShell.tsx');
    expect(shell).toContain('/logo.png');
    expect(shell).toContain('Edee Apply');
  });

  it('lists student applications with no status summary', () => {
    // The student site is for shortlisting and applying: applied colleges
    // render with no verdict, no status counts and no withdraw control.
    // page.tsx is the server component that fetches; the markup lives in
    // the client half it renders.
    const page = src('app/student/dashboard/StudentDashboardClient.tsx');
    expect(page).not.toContain('StatRow');
    expect(page).not.toContain('counts.');
    expect(page).not.toContain('onWithdraw');
    expect(page).not.toContain('APPLICATION_STATUS_LABEL');
    expect(page).toContain('AppliedCollegeCard');
  });

  it('filters the college inbox with status tabs, not a dropdown', () => {
    const page = src('app/college/applications/CollegeApplicationsClient.tsx');
    expect(page).toContain('role="tablist"');
    expect(page).not.toContain('filter-status');
  });

  it('links the coaching overview to invite codes', () => {
    const page = src('app/coaching/dashboard/CoachingDashboardClient.tsx');
    expect(page).toContain('/coaching/invite');
  });
});
