import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { bigOrders, logScaled, orders, synthBoost, wholeOrders } from './curves';

/** The hand-written forms these helpers replaced, kept here as the reference the outputs are pinned to. */
const oldMoleOrders = (moles: number) => (moles > 1 ? Math.log10(moles) : 0);
const oldHeatOrders = (value: ReturnType<typeof num>) => {
  const o = value.log10();
  return Number.isFinite(o) && o > 0 ? o : 0;
};

const NUMBERS = [0, -5, 0.5, 1, 1.0001, 2, 10, 50, 1e6, 1e300, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe('orders (continuous, plain number)', () => {
  it('equals the old Mole / Sleeve Euphoria form for every edge input', () => {
    for (const v of NUMBERS) expect(orders(v)).toBe(oldMoleOrders(v));
  });

  it('states the outcome: none up to 1, fractional between powers of ten, Infinity stays Infinity', () => {
    expect(orders(0)).toBe(0);
    expect(orders(-5)).toBe(0);
    expect(orders(Number.NaN)).toBe(0);
    expect(orders(1)).toBe(0);
    expect(orders(100)).toBe(2);
    expect(orders(50)).toBeCloseTo(1.699, 3);
    expect(orders(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('bigOrders (continuous, BigNum)', () => {
  it('equals the old ICE Rating heat form for every edge input', () => {
    for (const v of [0, -5, 0.5, 1, 2, 50, 1e6, 1e300, Number.NaN]) expect(bigOrders(num(v))).toBe(oldHeatOrders(num(v)));
  });

  it('is 0 for zero, negatives, NaN and values up to 1; fractional above', () => {
    for (const v of [0, -5, 1, Number.NaN]) expect(bigOrders(num(v))).toBe(0);
    expect(bigOrders(num(50))).toBeCloseTo(1.699, 3);
  });

  it('stays finite for a huge value (1e300 is 300 orders)', () => {
    expect(bigOrders(num(1e300))).toBeCloseTo(300, 6);
  });
});

describe('wholeOrders (floor, BigNum)', () => {
  it('floors: 9 -> 0, 10 -> 1, 99 -> 1, 100 -> 2', () => {
    expect([9, 10, 99, 100].map((v) => wholeOrders(num(v)))).toEqual([0, 1, 1, 2]);
  });

  it('is 0 for zero, negatives, NaN and values under 10', () => {
    for (const v of [0, -500, Number.NaN, 0.5]) expect(wholeOrders(num(v))).toBe(0);
  });

  it('counts a huge value (1e300 is 300 whole orders)', () => {
    expect(wholeOrders(num(1e300))).toBe(300);
  });
});

describe('logScaled', () => {
  it('equals the old Residual Proficiency form', () => {
    for (const x of [0, 1, 9, 99, 1e6, Number.NaN, -2, Number.POSITIVE_INFINITY]) {
      expect(logScaled(2.5, x)).toBe(2.5 * Math.log10(1 + x));
    }
  });

  it('is 0 at 0, scale per order, NaN below -1 (the caller guards)', () => {
    expect(logScaled(3, 0)).toBe(0);
    expect(logScaled(3, 99)).toBeCloseTo(6, 12);
    expect(logScaled(3, -2)).toBeNaN();
  });
});

describe('synthBoost', () => {
  it('equals the old inline form for both skills', () => {
    for (const [perLn, n, copies] of [
      [0.1, 0, 1],
      [0.1, 5, 2],
      [0.25, 1000, 3],
      [0.5, 1e6, 1],
    ] as const) {
      expect(synthBoost(perLn, n, copies)).toBe((1 + perLn * Math.log1p(n)) ** copies);
    }
  });

  it('is 1 with no synths or no copies, and grows with both', () => {
    expect(synthBoost(0.3, 0, 4)).toBe(1);
    expect(synthBoost(0.3, 10, 0)).toBe(1);
    expect(synthBoost(0.3, 10, 2)).toBeGreaterThan(synthBoost(0.3, 10, 1));
    expect(synthBoost(0.3, 100, 1)).toBeGreaterThan(synthBoost(0.3, 10, 1));
  });
});
