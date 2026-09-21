import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Reveal from '@/components/ui/Reveal';

describe('Reveal', () => {
  it('renders children visibly without an IntersectionObserver', () => {
    // jsdom has no IntersectionObserver: the component must degrade to
    // visible content rather than hiding it forever.
    render(
      <Reveal>
        <p>Always seen</p>
      </Reveal>,
    );
    const paragraph = screen.getByText('Always seen');
    expect(paragraph).toBeInTheDocument();
    // Falls through to the visible end-state instead of hiding content.
    expect(paragraph.closest('div')).toHaveClass('is-visible');
  });
});
