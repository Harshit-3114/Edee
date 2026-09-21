import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

describe('design tokens', () => {
  it('locks a single maroon accent with no second accent', () => {
    expect(css).toContain('--accent: #7f1d1d');
    expect(css).toContain('--accent-hover: #641414');
    expect(css).toContain('--pine: #3d0b0b');
    expect(css).toContain('--focus-ring: #7f1d1d');
    // No emerald left anywhere in the accent ramp.
    expect(css).not.toContain('--accent: #047857');
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
