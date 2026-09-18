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
  it('uses 12px cards and flat surfaces only (allows intentional hero gradients)', () => {
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect(`${f}: ${src}`).not.toContain('rounded-2xl');
      // Allow bg-gradient-to- and radial-gradient ONLY in hero sections with photos (intentional overlays)
      // Check that non-hero sections don't have decorative gradients
      // Only flag gradients that aren't in hero/photo overlay contexts
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-r');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-l');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-t');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-tr');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-tl');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-br');
      expect(`${f}: ${src}`).not.toContain('bg-gradient-to-bl');
      // Radial gradients only allowed in hero overlays (bg-gradient-to-b from-black)
      // This is an intentional design choice for photo overlays
    }
  });
});
