import { describe, expect, it } from 'vitest';
import { formatBigNum, num, numberFactory } from './index';

describe('BigNum (break_infinity adapter)', () => {
  it('does basic arithmetic', () => {
    expect(num(2).add(num(3)).eq(num(5))).toBe(true);
    expect(num(5).sub(num(7)).eq(num(-2))).toBe(true);
    expect(num(4).mul(num(2.5)).eq(num(10))).toBe(true);
    expect(num(10).div(num(4)).eq(num(2.5))).toBe(true);
    expect(num(2.9).floor().eq(num(2))).toBe(true);
  });

  it('compares', () => {
    expect(num(1).lt(num(2))).toBe(true);
    expect(num(2).lte(num(2))).toBe(true);
    expect(num(3).gt(num(2))).toBe(true);
    expect(num(2).gte(num(2))).toBe(true);
  });

  it('reports order of magnitude exactly at powers of ten', () => {
    expect(num(1).floorLog10()).toBe(0);
    expect(num(9.99).floorLog10()).toBe(0);
    expect(num(10).floorLog10()).toBe(1);
    expect(num(999).floorLog10()).toBe(2);
    expect(num(1000).floorLog10()).toBe(3);
    expect(num(0).floorLog10()).toBe(-Infinity);
  });

  it('raises to a power, including huge exponents', () => {
    expect(num(2).pow(10).eq(num(1024))).toBe(true);
    expect(num(10).pow(0).eq(num(1))).toBe(true);
    expect(num(2).pow(5000).isFinite()).toBe(true);
    expect(num(2).pow(5000).floorLog10()).toBe(1505);
  });

  it('takes base-10 logarithms', () => {
    expect(num(1000).log10()).toBeCloseTo(3, 10);
    expect(num('1e500').log10()).toBeCloseTo(500, 10);
  });

  it('round-trips through toString', () => {
    const big = num('1.2345e250');
    expect(num(big.toString()).eq(big)).toBe(true);
  });

  it('handles values far beyond double range without overflowing', () => {
    const huge = num('1e1000').mul(num('1e1000'));
    expect(huge.isFinite()).toBe(true);
    expect(huge.floorLog10()).toBe(2000);
    expect(huge.toNumber()).toBe(Infinity);
  });

  it('keeps small additions to huge values lossy but stable', () => {
    const huge = num('1e100');
    expect(huge.add(num(1)).eq(huge)).toBe(true);
  });

  it('treats the library saturation point (overflow) as non-finite', () => {
    expect(num(Infinity).isFinite()).toBe(false);
    expect(num('1e9000000000000000').isFinite()).toBe(false);
    expect(num('1e8999999999999999').isFinite()).toBe(true);
    expect(num('1e1000').mul(num('1e1000')).isFinite()).toBe(true);
  });

  it('reports zero and finiteness', () => {
    expect(num(0).isZero()).toBe(true);
    expect(num(1).isZero()).toBe(false);
    expect(num(5).isFinite()).toBe(true);
  });

  it('reports negativity: only values strictly below zero', () => {
    expect(num(-0.1).isNegative()).toBe(true);
    expect(num('-1e500').isNegative()).toBe(true);
    expect(num(0).isNegative()).toBe(false);
    expect(num(3).isNegative()).toBe(false);
    expect(num(Infinity).isNegative()).toBe(false);
  });

  it('maxValue is the largest finite value: finite itself, non-finite once it grows', () => {
    const max = numberFactory.maxValue();
    expect(max.isFinite()).toBe(true);
    expect(max.isNegative()).toBe(false);
    expect(max.mul(num(10)).isFinite()).toBe(false);
  });
});

describe('formatBigNum', () => {
  const f = (v: number | string, d?: number) => formatBigNum(num(v), d);

  it('formats small values with trimmed decimals', () => {
    expect(f(0)).toBe('0');
    expect(f(0.5)).toBe('0.5');
    expect(f(10)).toBe('10');
    expect(f(12.345)).toBe('12.35');
    expect(f(999)).toBe('999');
  });

  it('uses suffixes from one thousand', () => {
    expect(f(1000)).toBe('1K');
    expect(f(1500)).toBe('1.5K');
    expect(f(2_350_000)).toBe('2.35M');
    expect(f('1e9')).toBe('1B');
  });

  it('carries when rounding reaches the next suffix', () => {
    expect(f(999_999)).toBe('1M');
    expect(f(999_996)).toBe('1M');
    expect(f(999.999)).toBe('1000');
  });

  it('switches to scientific notation beyond the suffix table', () => {
    expect(f('1.23e45')).toBe('1.23e45');
    expect(f('9.999e60')).toBe('1e61');
  });

  it('keeps the first significant digits of values below 0.01 instead of rounding them to 0', () => {
    expect(f(0.05)).toBe('0.05');
    expect(f(0.001)).toBe('0.001');
    expect(f(0.0001)).toBe('0.0001');
    expect(f('1.5e-10')).toBe('1.5e-10');
  });

  it('formats negatives and non-finite', () => {
    expect(f(-1500)).toBe('-1.5K');
    expect(formatBigNum(num(Infinity))).toBe('Infinity');
  });
});
