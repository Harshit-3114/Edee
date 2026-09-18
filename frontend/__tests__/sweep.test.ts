import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'components/college/CollegeLandingPage.tsx',
  'components/student/CheckoutSummary.tsx',
  'app/(public)/about/page.tsx',
  'app/(public)/why-us/page.tsx',
  'app/(public)/contact/page.tsx',
];

describe('radii + gradient sweep', () => {
  it('uses 12px cards and flat surfaces only', () => {
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect(`${f}: ${src}`).not.toContain('rounded-2xl');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-');
      expect(`${f}: ${src}`).not.toContain('radial-gradient');
    }
  });
});
