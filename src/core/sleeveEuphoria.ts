/**
 * @module core
 *
 * The curve behind Sleeve Euphoria: how much less action XP a level needs, as a function of the sleeve level.
 */

/**
 * The share of the action XP requirement that Sleeve Euphoria takes away at a sleeve level.
 *
 * @remarks
 * Every order of magnitude of sleeve level leaves `remainingPerOrder` of what was left: `1 - remainingPerOrder ^ log10(level)`.
 * With 0.5 that is nothing at level 1, 50% at level 10, 75% at level 100 and 87.5% at level 1000. It is concave (each further level
 * is worth less than the one before) and never reaches 100%; `maxReduction` is the ceiling it is held under, which also keeps the
 * remaining share above 0 (a requirement of 0 would divide by zero in the level maths). A level of 1 or less, and anything that is
 * not a number, takes nothing away.
 *
 * Called by: `progression.ts`.
 *
 * @param sleeveLevel the sleeve level of the action (a whole number >= 0)
 * @param remainingPerOrder the share that is left after each order of magnitude of level (in (0, 1); 0.5 halves it)
 * @param maxReduction the most that can be taken away (in [0, 1))
 * @returns a fraction in [0, `maxReduction`]
 */
export function euphoriaReduction(sleeveLevel: number, remainingPerOrder: number, maxReduction: number): number {
  if (!(sleeveLevel > 1)) return 0;
  const reduction = 1 - remainingPerOrder ** Math.log10(sleeveLevel);
  if (!(reduction > 0)) return 0;
  return Math.min(reduction, maxReduction);
}
