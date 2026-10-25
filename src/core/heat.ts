/**
 * @module core
 *
 * Heat: a tax on all credits earned (one point of heat is one percent, lowered by ICE Rating) and its cooldown.
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
 * @param reduction share of the heat's effect removed by ICE Rating (0..1)
 * @param taxPerPoint share of earned credits one heat point takes (`sleeve.heatTaxPerPoint`, 0.01 = 1%)
 * @returns `1 - heat * (1 - reduction) * taxPerPoint`, never below 0. With 1% per point and no reduction, 100 heat keeps
 *   nothing; with a 50% reduction, credits only stop at 200 heat.
 */
export function heatTaxFactor(heat: number, reduction: number, taxPerPoint: number): number {
  if (!(heat > 0)) return 1;
  return Math.max(0, 1 - heat * (1 - reduction) * taxPerPoint);
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

/** Heat, the progress of its current cooldown cycle and the Moles that make part of it faster. */
export interface BoostedCooldownState extends HeatCooldownState {
  /** Points of heat that still cool down faster (>= 0). */
  readonly moles: number;
}

/**
 * Advances the heat cooldown in closed form with a cooldown speed and a Mole boost.
 *
 * @remarks
 * `cooldownMs` counts progress in units of normal-speed time, so a cooldown that runs `speed` times as fast simply advances
 * `speed` times as far per millisecond, and a change of speed never makes the bar jump. While Moles remain, the cooldown runs
 * `boost` faster still (`speed * (1 + boost)`), and every point of heat cooled uses up one Mole; once the Moles are used up
 * (or the heat is gone) the cooldown goes on at `speed`. The boosted stretch is worked out first (it lasts until the
 * Moles or the heat run out), then the rest of the time at normal pace, so the cost never depends on `deltaMs`.
 * With `speed` 1 and no Moles it equals {@link coolHeat}.
 *
 * Called by: `cooldowns.ts`. Calls: {@link coolHeat}.
 *
 * @param current heat, cycle progress and Moles before the step
 * @param deltaMs elapsed game time (>= 0)
 * @param cycleMs time one cooldown cycle takes at normal speed (> 0)
 * @param amount heat removed per completed cycle (> 0)
 * @param speed how many times as fast heat cools without Moles (>= 1)
 * @param boost the extra speed while Moles remain (0.5 = 50 percent faster; >= 0)
 * @returns heat, cycle progress and Moles after the step
 */
export function coolHeatBoosted(
  current: BoostedCooldownState,
  deltaMs: number,
  cycleMs: number,
  amount: number,
  speed: number,
  boost: number,
): BoostedCooldownState {
  if (!(current.heat > 0)) return current;
  let { heat, cooldownMs, moles } = current;
  let time = deltaMs;
  const fast = speed * (1 + boost);
  if (moles > 0 && boost > 0) {
    const limit = Math.min(Math.ceil(moles / amount), Math.ceil(heat / amount)); // cycles the boost can last
    const progress = cooldownMs + time * fast;
    const cycles = Math.floor(progress / cycleMs);
    if (cycles < limit) {
      const cooled = cycles * amount;
      return { heat: heat - cooled, cooldownMs: progress - cycles * cycleMs, moles: Math.max(0, moles - cooled) };
    }
    // The Moles or the heat run out within this step: finish those cycles boosted, then carry on at normal pace.
    const timeUsed = Math.max(0, (limit * cycleMs - cooldownMs) / fast);
    const cooled = Math.min(heat, limit * amount);
    heat -= cooled;
    moles = Math.max(0, moles - cooled);
    cooldownMs = 0;
    time = Math.max(0, time - timeUsed);
    if (heat <= 0) return { heat: 0, cooldownMs: 0, moles };
  }
  const rest = coolHeat({ heat, cooldownMs }, time * speed, cycleMs, amount);
  return { heat: rest.heat, cooldownMs: rest.cooldownMs, moles };
}
