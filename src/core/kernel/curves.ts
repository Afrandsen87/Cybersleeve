/**
 * @module core
 *
 * "Per order of magnitude" helpers: the few ways the game turns a big amount into a count of powers of ten.
 *
 * @remarks
 * `orders` / `bigOrders` are CONTINUOUS (log10, so 50 is 1.7 orders) and feed smooth curves (heat reduction, Sleeve Euphoria, Deep Cover). They
 * clamp at 0: a value that is not above 1, NaN and negatives have none.
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

/**
 * The boost a synthetic-sleeve count gives: `(1 + perLn x ln(1 + synths)) ^ copies`. One definition for the interface-speed skill and the
 * corporation-speed skill, so the two cannot drift apart.
 *
 * Called by: `resleeve/resleeveEffects.ts` (`interfaceSpeedPerLnSynths`), `corporation/corporation.ts` (`workersFactor`). Calls: nothing.
 *
 * @param perLn boost per natural-log step of the synth count (> 0)
 * @param synths how many synthetic sleeves there are (>= 0)
 * @param copies copies of the skill owned (>= 0)
 * @returns the factor (1 with no synths or no copies)
 */
export function synthBoost(perLn: number, synths: number, copies: number): number {
  return (1 + perLn * Math.log1p(synths)) ** copies;
}
