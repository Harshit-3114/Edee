import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

describe('design tokens', () => {
  it('locks single emerald accent and deletes maroon/gold', () => {
    expect(css).toContain('--accent: #047857');
    expect(css).toContain('--accent-hover: #065f46');
    expect(css).not.toContain('#D9475C');
    expect(css).not.toContain('#F2BB5D');
    expect(css).not.toContain('--accent-secondary');
  });

  it('defines success + action status tokens in light mode', () => {
    expect(css).toContain('--success: #047857');
    expect(css).toContain('--action: #c2410c');
    expect(css).toContain('--action-subtle: #f7cfa1');
  });

  it('has no decorative gradient utilities or vignette', () => {
    // The neutral skeleton shimmer stays: it is a loading state, not decoration.
    expect(css).not.toContain('.vignette');
    expect(css).not.toContain('.hero-content');
    expect(css).not.toContain('.scale-hover');
  });
});
