import { describe, it, expect } from 'vitest';
import { computePromoDiscount } from './promo';

describe('computePromoDiscount', () => {
  it('returns 0 when no promo is applied', () => {
    expect(computePromoDiscount(null, 49.99)).toBe(0);
  });

  it('applies a percentage discount to the eligible amount', () => {
    expect(computePromoDiscount({ discountType: 'PERCENTAGE', discountValue: 20 }, 50)).toBe(10);
  });

  it('applies a fixed discount', () => {
    expect(computePromoDiscount({ discountType: 'FIXED', discountValue: 15 }, 49.99)).toBe(15);
  });

  it('never discounts more than the eligible amount (zero floor)', () => {
    expect(computePromoDiscount({ discountType: 'FIXED', discountValue: 80 }, 49.99)).toBe(49.99);
    expect(computePromoDiscount({ discountType: 'PERCENTAGE', discountValue: 150 }, 40)).toBe(40);
  });

  it('never returns a negative discount', () => {
    expect(computePromoDiscount({ discountType: 'FIXED', discountValue: -5 }, 49.99)).toBe(0);
    expect(computePromoDiscount({ discountType: 'FIXED', discountValue: 10 }, 0)).toBe(0);
  });
});
