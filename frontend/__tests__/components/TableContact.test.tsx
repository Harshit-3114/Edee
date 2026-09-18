import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { TableWrap } from '@/components/ui/Table';

const contact = readFileSync(
  resolve(__dirname, '../../app/(public)/contact/page.tsx'),
  'utf8',
);
const input = readFileSync(
  resolve(__dirname, '../../components/ui/Input.tsx'),
  'utf8',
);

describe('table + contact', () => {
  it('wraps tables in 12px cards', () => {
    const { container } = render(
      <TableWrap>
        <table>
          <tbody>
            <tr>
              <td>x</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>,
    );
    expect(container.firstElementChild?.className).toContain('rounded-xl');
  });

  it('has no emoji fallback', () => {
    expect(contact).not.toContain('<span>✉</span>');
    expect(contact).toContain('EnvelopeSimple');
  });

  it('rings inputs in emerald on focus', () => {
    expect(input).toContain('focus:border-[var(--accent)]');
    expect(input).toContain('focus:ring-[var(--accent)]/20');
  });
});
