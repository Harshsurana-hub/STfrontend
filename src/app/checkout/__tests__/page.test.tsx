import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CheckoutPage, { metadata } from '../page';

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => <div data-testid="top-bar">TopBar Mock</div>,
}));

vi.mock('@/components/checkout/CheckoutContent', () => ({
  CheckoutContent: () => <div data-testid="checkout-content">Checkout Content Mock</div>,
}));

describe('CheckoutPage', () => {
  it('exports correct metadata with title Checkout', () => {
    expect(metadata.title).toBe('Checkout');
  });

  it('renders TopBar and CheckoutContent without network or router errors', () => {
    render(<CheckoutPage />);

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-content')).toBeInTheDocument();
    expect(screen.getByText('Checkout Content Mock')).toBeInTheDocument();
  });
});
