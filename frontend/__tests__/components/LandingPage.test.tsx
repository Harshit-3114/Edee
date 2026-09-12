import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingPage from '@/app/(public)/page';

describe('LandingPage', () => {
  it('brands the product as Edee Apply', () => {
    render(<LandingPage />);
    expect(screen.getByRole('link', { name: 'Edee Apply' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Edee Apply', { selector: 'footer p' })).toBeInTheDocument();
  });

  it('carries no external placeholder imagery', () => {
    render(<LandingPage />);
    const external = Array.from(document.querySelectorAll('img')).filter((img) =>
      img.currentSrc.startsWith('http'),
    );
    expect(external).toHaveLength(0);
  });

  it('walks a visitor from hero to signup', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: /apply to every college on one list/i }),
    ).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('link', { name: /see how it works/i }),
    ).toHaveAttribute('href', '#how-it-works');
    expect(
      within(main).getAllByRole('link', { name: /get started/i })[0],
    ).toHaveAttribute('href', '/login');
  });

  it('answers real objections with real product behaviour', () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/not refundable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/withdraw any application/i)).toBeInTheDocument();
    expect(screen.getByText(/invite code/i)).toBeInTheDocument();
  });
});
