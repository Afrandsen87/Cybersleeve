/**
 * @module core
 *
 * The curve that turns an accumulated, unbounded reward into the bonus that is actually applied, so that each further
 * point of the reward is worth less than the one before.
 */

/** Exponents closer to 0 than this are treated as 0 (the logarithm), where the power form divides by almost nothing. */
const LOG_EXPONENT_EPSILON = 1e-9;

/**
 * Concave (diminishing-returns) curve with no ceiling: `scale * ((1 + raw)^exponent - 1) / exponent`.
 *
 * @remarks
 * Starts at 0 for `raw = 0` with slope `scale`, rises forever, and rises ever more slowly for `exponent < 1`. At `exponent = 1`
 * it is the straight line `scale * raw`; at `exponent = 0` it is `scale * ln(1 + raw)`; between them it grows like
 * `raw^exponent`. Evaluated with `expm1`/`log1p` so tiny `raw` keeps its precision.
 * Called by: `effects.ts` (`resolveSleeveStats`).
 *
 * @param raw accumulated reward (>= 0; negatives and NaN count as 0, `Infinity` as the largest double)
 * @param scale slope at `raw = 0` (> 0)
 * @param exponent curve shape (<= 1; 1 = linear, 0 = logarithm, may be negative)
 * @returns the applied bonus (>= 0, finite)
 */
export function concaveBonus(raw: number, scale: number, exponent: number): number {
  if (!(raw > 0)) return 0;
  const bounded = Math.min(raw, Number.MAX_VALUE);
  const curved = Math.abs(exponent) < LOG_EXPONENT_EPSILON ? Math.log1p(bounded) : Math.expm1(exponent * Math.log1p(bounded)) / exponent;
  const result = scale * curved;
  return Number.isFinite(result) ? result : Number.MAX_VALUE;
}
