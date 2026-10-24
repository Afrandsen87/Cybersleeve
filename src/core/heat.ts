/**
 * @module core
 *
 * Heat: a tax on all credits earned (one point of heat is one percent, lowered by Circumvention) and its cooldown.
 */

/** Heat and the progress of its current cooldown cycle. */
export interface HeatCooldownState {
  /** Current heat (>= 0). */
  readonly heat: number;
  /** Time spent on the current cooldown cycle, in ms. Only advances while heat is above 0. */
  readonly cooldownMs: number;
}

/**
 * The share of earned credits that is kept after the heat tax.
 *
 * Called by: `engine.ts`, `economy.ts`.
 *
 * @param heat heat points (>= 0; NaN and negatives count as 0)
 * @param reduction share of the heat's effect removed by Circumvention (0..1; default 0)
 * @returns `1 - heat * (1 - reduction) / 100`, never below 0. With no reduction, 100 heat or more keeps nothing; with a 50%
 *   reduction, credits only stop at 200 heat.
 */
export function heatTaxFactor(heat: number, reduction = 0): number {
  if (!(heat > 0)) return 1;
  return Math.max(0, 1 - (heat * (1 - reduction)) / 100);
}

/**
 * Advances the heat cooldown in closed form: every full `cycleMs` removes `amount` heat.
 *
 * @remarks
 * Time only counts while heat is above 0; once heat reaches 0 the cycle restarts from 0 and waits.
 * The cost does not depend on `deltaMs`, so long ticks are cheap.
 *
 * Called by: `engine.ts`.
 *
 * @param current heat and cycle progress before the step
 * @param deltaMs elapsed game time (>= 0)
 * @param cycleMs time one cooldown cycle takes (> 0)
 * @param amount heat removed per completed cycle (> 0)
 * @returns heat and cycle progress after the step
 */
export function coolHeat(current: HeatCooldownState, deltaMs: number, cycleMs: number, amount: number): HeatCooldownState {
  if (!(current.heat > 0)) return current;
  const total = current.cooldownMs + deltaMs;
  const cycles = Math.floor(total / cycleMs);
  if (cycles >= Math.ceil(current.heat / amount)) return { heat: 0, cooldownMs: 0 };
  return { heat: current.heat - cycles * amount, cooldownMs: total - cycles * cycleMs };
}
