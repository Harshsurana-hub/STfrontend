import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingTiers } from './PricingTiers';

describe('PricingTiers Component (Issue #118)', () => {
  it('exposes the tier grid as a region with an accessible name', () => {
    render(<PricingTiers />);
    const region = screen.getByRole('region', { name: /pricing tiers/i });
    expect(region).toBeInTheDocument();
  });

  it('provides an accessible name for each CTA button that includes its tier name', () => {
    render(<PricingTiers />);

    expect(
      screen.getByRole('button', { name: /Get Starter Quote for Starter Team/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /Get Growth Quote for Growth Plan/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /Contact Sales for Enterprise/i })
    ).toBeInTheDocument();
  });

  it('links the popular badge to the popular tier card via aria-describedby', () => {
    render(<PricingTiers />);

    const badge = screen.getByText('Most Popular');
    expect(badge).toHaveAttribute('id', 'tier-badge-growth');

    const card = badge.closest('div');
    expect(card).toHaveAttribute('aria-describedby', 'tier-badge-growth');
  });

  it('calls onSelectTier with the appropriate tier name when clicked', () => {
    const handleSelect = vi.fn();
    render(<PricingTiers onSelectTier={handleSelect} />);

    const starterButton = screen.getByRole('button', {
      name: /Get Starter Quote for Starter Team/i,
    });
    fireEvent.click(starterButton);

    expect(handleSelect).toHaveBeenCalledWith('Starter Team');
  });
});
