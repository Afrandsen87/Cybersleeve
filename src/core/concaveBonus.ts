/**
 * @module core
 *
 * The curve that turns an accumulated, unbounded reward into the bonus that is actually applied, so that each further
 * point of the reward is worth less than the one before.
 */

import { INFINITY } from './infinity';

/** Exponents closer to 0 than this are treated as 0 (the logarithm), where the power form divides by almost nothing. */
const LOG_EXPONENT_EPSILON = 1e-9;

/** Where a concave curve changes shape: past `knee` it continues with another exponent. */
export interface CurveBeyond {
  /** The amount of `raw` at which the curve changes (>= 0). */
  readonly knee: number;
  /** The curve shape past the knee (<= 1; the same meaning as `exponent`). */
  readonly exponent: number;
}

/** `((1 + x)^exponent - 1) / exponent` written with `d = ln(1 + x)`: `(e^(exponent * d) - 1) / exponent`, or `d` where the exponent is 0. */
function powerCurve(exponent: number, d: number): number {
  return Math.abs(exponent) < LOG_EXPONENT_EPSILON ? d : Math.expm1(exponent * d) / exponent;
}

/**
 * Concave (diminishing-returns) curve with no ceiling: `scale * ((1 + raw)^exponent - 1) / exponent`, optionally changing shape at a knee.
 *
 * @remarks
 * Starts at 0 for `raw = 0` with slope `scale`, rises forever, and rises ever more slowly for `exponent < 1`. At `exponent = 1`
 * it is the straight line `scale * raw`; at `exponent = 0` it is `scale * ln(1 + raw)`; between them it grows like
 * `raw^exponent`. Evaluated with `expm1`/`log1p` so tiny `raw` keeps its precision.
 *
 * With `beyond`, the curve above is used up to `beyond.knee`; past it the curve continues with `beyond.exponent` from the value AND the
 * slope it had at the knee, so nothing jumps or kinks there. With `r = (1 + raw) / (1 + knee)` the value past the knee is
 * `curve(knee) + scale * (1 + knee)^exponent * (r^beyondExponent - 1) / beyondExponent`. A `beyond.exponent` below `exponent` flattens
 * the curve past the knee (each point is worth less than before); equal to `exponent` it changes nothing.
 * Called by: `effects.ts` (`resolveSleeveStats`).
 *
 * @param raw accumulated reward (>= 0; negatives and NaN count as 0, `Infinity` as the game's infinity)
 * @param scale slope at `raw = 0` (> 0)
 * @param exponent curve shape (<= 1; 1 = linear, 0 = logarithm, may be negative)
 * @param beyond a second shape for amounts past a knee (default: none, one curve all the way)
 * @returns the applied bonus (>= 0, finite)
 */
export function concaveBonus(raw: number, scale: number, exponent: number, beyond?: CurveBeyond): number {
  if (!(raw > 0)) return 0;
  const bounded = Math.min(raw, INFINITY);
  let curved: number;
  if (beyond && bounded > beyond.knee) {
    const atKnee = powerCurve(exponent, Math.log1p(beyond.knee));
    // slope at the knee is (1 + knee)^(exponent - 1); the second piece keeps it, so the join is smooth
    const slope = (1 + beyond.knee) ** exponent;
    curved = atKnee + slope * powerCurve(beyond.exponent, Math.log1p(bounded) - Math.log1p(beyond.knee));
  } else {
    curved = powerCurve(exponent, Math.log1p(bounded));
  }
  const result = scale * curved;
  return Number.isFinite(result) ? Math.min(result, INFINITY) : INFINITY;
}
