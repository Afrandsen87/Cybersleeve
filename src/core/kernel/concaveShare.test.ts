/**
 * `concaveShare`, the curve of the ICE Rating heat reduction: `(orders / ordersForFull) ^ exponent`, clamped to [0, 1].
 *
 * Purpose: state the outcomes at zero, negatives, the goal, far beyond it, NaN and Infinity.
 * Called by: vitest. Calls: `concaveShare`.
 */
import { describe, expect, it } from 'vitest';
import { concaveShare } from './curves';

describe('concaveShare', () => {
  it('is 0 at no orders, for negatives and for NaN', () => {
    for (const orders of [0, -3, Number.NaN, Number.NEGATIVE_INFINITY]) expect(concaveShare(orders, 100, 0.5)).toBe(0);
  });

  it('is a square root with exponent 0.5: 4 orders of 100 is 20%, 25 orders is 50%', () => {
    expect(concaveShare(4, 100, 0.5)).toBeCloseTo(0.2, 12);
    expect(concaveShare(25, 100, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('is a straight line with exponent 1', () => {
    expect(concaveShare(50, 200, 1)).toBeCloseTo(0.25, 12);
  });

  it('is 1 at the goal and stays 1 beyond it, however far, even at Infinity', () => {
    for (const orders of [100, 101, 1e300, Number.POSITIVE_INFINITY]) expect(concaveShare(orders, 100, 0.5)).toBe(1);
  });

  it('never goes down as the orders grow', () => {
    let last = 0;
    for (const orders of [0.1, 1, 4, 30, 99, 100, 500]) {
      const share = concaveShare(orders, 100, 0.5);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
  });

  it('a goal that is not above 0 gives full share for any positive orders and none otherwise', () => {
    expect(concaveShare(1, 0, 0.5)).toBe(1);
    expect(concaveShare(1, Number.NaN, 0.5)).toBe(1);
    expect(concaveShare(0, 0, 0.5)).toBe(0);
  });
});
