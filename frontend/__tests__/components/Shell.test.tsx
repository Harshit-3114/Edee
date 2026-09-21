import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shell = readFileSync(
  resolve(__dirname, '../../components/shells/PortalShell.tsx'),
  'utf8',
);

describe('sovereign shell', () => {
  it('keeps nav in a top h-16 header with max-w-7xl content, no sidebar', () => {
    expect(shell).toContain('h-16');
    expect(shell).toContain('max-w-7xl');
    expect(shell).not.toContain('w-64');
    expect(shell).not.toContain('sidebar');
    expect(shell).not.toContain('Sidebar');
  });

  it('has a working bell, no dead controls', () => {
    expect(shell).toContain('NotificationBell');
    expect(shell).not.toContain('role="search"');
    expect(shell).not.toContain('Synced');
    expect(shell).not.toContain('⌘K');
  });

  it('toggles the nav with v4-compatible classes (no v3 !-prefix)', () => {
    expect(shell).not.toMatch(/md:!(block|flex|grid|hidden|inline)/);
  });

  it('renders sign-out as a red button', () => {
    expect(shell).toContain('Sign out');
    expect(shell).toContain('var(--danger)');
  });
});
