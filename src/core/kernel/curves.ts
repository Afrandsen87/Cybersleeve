/**
 * @module core
 *
 * "Per order of magnitude" helpers: the few ways the game turns a big amount into a count of powers of ten.
 *
 * @remarks
 * Two meanings exist on purpose and have different names. `orders` / `bigOrders` are CONTINUOUS (log10, so 50 is 1.7 orders) and feed
 * smooth curves (heat reduction, Sleeve Euphoria, Deep Cover); `wholeOrders` is the FLOOR (50 is 1 order) and feeds step effects
 * (rarity shifts). Both clamp at 0: a value that is not above 1 (or above 10 for the whole count), NaN and negatives have none.
 */

import type { BigNum } from '../../numbers';

/**
 * Continuous orders of magnitude of a plain number: `log10(value)` for `value > 1`, else 0.
 *
 * Called by: `sleeve/sleeveEuphoria.ts`, `heat/heatPace.ts`. Calls: nothing.
 *
 * @param value the amount (NaN, negatives, 0 and anything up to 1 give 0; `Infinity` gives `Infinity`)
 * @returns a number >= 0
 */
export function orders(value: number): number {
  return value > 1 ? Math.log10(value) : 0;
}

/**
 * Continuous orders of magnitude of a `BigNum`: `log10(value)`, clamped at 0, and 0 when the logarithm is not finite.
 *
 * Called by: `effects/sleeveResolver.ts` (`resolveSleeveStats`, ICE Rating heat reduction). Calls: `BigNum.log10`.
 *
 * @param value the amount (zero, negatives, NaN and values up to 1 give 0)
 * @returns a finite number >= 0
 */
export function bigOrders(value: BigNum): number {
  const result = value.log10();
  return Number.isFinite(result) && result > 0 ? result : 0;
}

/**
 * Whole orders of magnitude: `floor(log10(value))`, never below 0 (a value under 10 has none).
 *
 * Called by: `engine/stats.ts` (`DerivedStats.itemDrops`), `ui/viewModel.ts`. Calls: `BigNum.floorLog10`.
 *
 * @param value the amount (Hacking Proficiency)
 * @returns a whole number >= 0 (0 for zero, negatives, NaN and values under 10)
 */
export function wholeOrders(value: BigNum): number {
  if (value.isZero() || value.isNegative() || value.isNaN()) return 0;
  const result = value.floorLog10();
  return Number.isFinite(result) && result > 0 ? result : 0;
}

/**
 * `scale * log10(1 + amount)`, unclamped (the caller decides what a negative or non-finite result means).
 *
 * Called by: `resleeve/resleeveCarry.ts` (Residual Proficiency). Calls: nothing.
 *
 * @param scale multiplier per order
 * @param amount the amount (> -1 for a number; NaN passes through)
 * @returns the scaled logarithm (NaN for `amount < -1`)
 */
export function logScaled(scale: number, amount: number): number {
  return scale * Math.log10(1 + amount);
}
