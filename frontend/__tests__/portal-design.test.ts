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

  it('summarises student applications by status above the list', () => {
    const page = src('app/student/dashboard/page.tsx');
    expect(page).toContain('StatRow');
    expect(page).toContain('counts.');
  });

  it('filters the college inbox with status tabs, not a dropdown', () => {
    const page = src('app/college/applications/page.tsx');
    expect(page).toContain('role="tablist"');
    expect(page).not.toContain('filter-status');
  });

  it('links the coaching overview to invite codes', () => {
    const page = src('app/coaching/dashboard/page.tsx');
    expect(page).toContain('/coaching/invite');
  });
});
