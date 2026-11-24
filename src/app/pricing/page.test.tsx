import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import PricingPage from './page';

// Controls whether useSearchParams suspends: while `pending` is set, the mock throws it
// (the Suspense protocol), so PricingPlansSection suspends until the test resolves it.
const search = vi.hoisted(() => ({
  pending: null as Promise<void> | null,
  resolve: () => {},
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/pricing',
  useSearchParams: () => {
    if (search.pending) throw search.pending;
    return new URLSearchParams();
  },
}));

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => null,
}));

describe('PricingPage Suspense boundary', () => {
  beforeEach(() => {
    search.pending = new Promise<void>((resolve) => {
      search.resolve = () => {
        search.pending = null;
        resolve();
      };
    });
  });

  it('shows the fallback while the plans suspend on useSearchParams, then the plans', async () => {
    const { container } = render(<PricingPage />);

    // The rest of the page renders around the boundary while the section is suspended.
    expect(
      screen.getByRole('heading', { name: /learn faster with a plan that grows with you/i }),
    ).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pro' })).not.toBeInTheDocument();

    await act(async () => {
      search.resolve();
      await search.pending;
    });

    expect(await screen.findByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });
});
