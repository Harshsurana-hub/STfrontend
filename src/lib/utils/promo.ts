export interface PromoDiscount {
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
}

/**
 * Returns the discount a promo code gives on `eligibleAmount` (the price of the course the
 * code was validated against). The result is never negative and never exceeds
 * `eligibleAmount`, so the discounted price cannot drop below zero.
 */
export function computePromoDiscount(promo: PromoDiscount | null, eligibleAmount: number): number {
  if (!promo || !(eligibleAmount > 0)) return 0;
  const raw =
    promo.discountType === 'PERCENTAGE'
      ? (eligibleAmount * promo.discountValue) / 100
      : promo.discountValue;
  return Math.min(eligibleAmount, Math.max(0, raw));
}
