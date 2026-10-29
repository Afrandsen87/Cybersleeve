/**
 * @module core
 *
 * What "infinity" means in the game: the one number at which an amount stops growing and counts as overflowed.
 */

/**
 * The game's infinity: 1e308. Every amount (credits, nodes, XP, ...) is held at or below it, and every multiplier derived from an
 * amount saturates at it. It sits just under the largest double (about 1.79e308), so plain-number multipliers and big-number
 * amounts overflow at the same place, and an amount reaching it is the signal for the overflow policy's reaction (the future
 * "infinity" prestige).
 *
 * Called by: `effects/sleeveResolver.ts`, `effects/queries.ts`, `speed.ts`, `concaveBonus.ts`, `fields.ts`, `overflow.ts`.
 */
export const INFINITY = 1e308;

/**
 * A derived multiplier as a usable number: NaN becomes `nan` (a bug upstream must not turn into a windfall) and anything above
 * {@link INFINITY} saturates there.
 *
 * Called by: `effects/sleeveResolver.ts`, `effects/queries.ts`, `speed.ts`, `concaveBonus.ts`.
 *
 * @param value the multiplier
 * @param nan what NaN becomes (default 1: no effect)
 * @returns a number that is never NaN and never above {@link INFINITY}
 */
export function saturate(value: number, nan = 1): number {
  return Number.isNaN(value) ? nan : Math.min(value, INFINITY);
}
