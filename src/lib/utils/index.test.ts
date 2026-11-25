import { describe, expect, it } from 'vitest';
import { usdcToStroops } from './index';

describe('usdcToStroops', () => {
  it('converts whole USDC amounts to stroops', () => {
    expect(usdcToStroops(1)).toBe(10_000_000n);
    expect(usdcToStroops('1')).toBe(10_000_000n);
    expect(usdcToStroops('0')).toBe(0n);
  });

  it('converts fractional USDC amounts to stroops', () => {
    expect(usdcToStroops('0.5')).toBe(5_000_000n);
    expect(usdcToStroops('1.25')).toBe(12_500_000n);
  });

  it('normalises empty whole parts', () => {
    expect(usdcToStroops('.5')).toBe(5_000_000n);
  });

  it('normalises empty fraction parts', () => {
    expect(usdcToStroops('1.')).toBe(10_000_000n);
  });

  it('throws for negative amounts', () => {
    expect(() => usdcToStroops('-1')).toThrow(Error);
    expect(() => usdcToStroops(-1)).toThrow(
      'usdcToStroops: amount must be a non-negative number'
    );
  });

  it('throws for non-numeric input', () => {
    expect(() => usdcToStroops('abc')).toThrow(Error);
    expect(() => usdcToStroops('1.2.3')).toThrow(Error);
    expect(() => usdcToStroops('')).toThrow(Error);
  });
});
