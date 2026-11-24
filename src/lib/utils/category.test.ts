import { describe, expect, it } from 'vitest';
import { getCategoryEmoji } from './category';

describe('getCategoryEmoji', () => {
  it('returns 🧵 for Tailoring', () => {
    expect(getCategoryEmoji('Tailoring')).toBe('🧵');
  });

  it('returns 🍰 for Baking', () => {
    expect(getCategoryEmoji('Baking')).toBe('🍰');
  });

  it('returns 📷 for Photography', () => {
    expect(getCategoryEmoji('Photography')).toBe('📷');
  });

  it('returns 💄 for Makeup Artistry', () => {
    expect(getCategoryEmoji('Makeup Artistry')).toBe('💄');
  });

  it('returns 💇 for Hairstyling', () => {
    expect(getCategoryEmoji('Hairstyling')).toBe('💇');
  });

  it('returns 💅 for Nail Technology', () => {
    expect(getCategoryEmoji('Nail Technology')).toBe('💅');
  });

  it('returns 🎓 for unknown category', () => {
    expect(getCategoryEmoji('Unknown Category')).toBe('🎓');
  });

  it('returns 🎓 for empty string', () => {
    expect(getCategoryEmoji('')).toBe('🎓');
  });
});
