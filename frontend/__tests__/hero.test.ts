import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('static hero', () => {
  it('ships local campus photos and drops the 3D deps', () => {
    expect(existsSync(resolve(__dirname, '../public/campuses/graduation.jpg'))).toBe(true);
    const page = readFileSync(
      resolve(__dirname, '../app/(public)/page.tsx'),
      'utf8',
    );
    expect(page).not.toContain('HeroGradient');
    expect(page).toContain('/campuses/graduation.jpg');
    const pkg = readFileSync(resolve(__dirname, '../package.json'), 'utf8');
    expect(pkg).not.toContain('shadergradient');
    expect(pkg).not.toContain('"three"');
    expect(pkg).not.toContain('react-three');
  });
});
