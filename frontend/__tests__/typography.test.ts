import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8');

describe('typography', () => {
  it('self-hosts Mulish + Poppins with no runtime font fetching', () => {
    expect(layout).toContain('@fontsource/mulish');
    expect(layout).toContain('@fontsource/poppins');
    expect(layout).not.toContain('next/font');
    expect(layout).not.toContain('Geist');
  });
});
