/**
 * @module core
 *
 * Heat: a tax on all credits earned (one point of heat is one percent, lowered by ICE Rating) and its cooldown.
 */

/**
 * Slack for floating-point sums of fractional heat: heat that comes to 0.9999999999 after many small additions counts as 1, and a
 * leftover smaller than this counts as nothing.
 */
const HEAT_EPSILON = 1e-9;

/** Heat and the progress of its current cooldown cycle. */
export interface HeatCooldownState {
  /** Current heat (>= 0). It may hold fractions of a point; the cooldown only removes whole `amount`s. */
  readonly heat: number;
  /** Time spent on the current cooldown cycle, in ms. Only advances while there is at least one whole `amount` of heat to remove. */
  readonly cooldownMs: number;
}

/**
 * How many whole cooldown cycles the heat can pay for: the cooldown removes `amount` at a time and never a fraction of it.
 *
 * Called by: {@link coolHeat}, {@link coolHeatBoosted}.
 *
 * @param heat heat points (>= 0)
 * @param amount heat removed per cycle (> 0)
 * @returns `floor(heat / amount)`, tolerant of tiny floating-point shortfalls
 */
function wholeCycles(heat: number, amount: number): number {
  return Math.floor(heat / amount + HEAT_EPSILON);
}

/** Heat with a leftover that is only floating-point dust taken for nothing. */
function settle(heat: number): number {
  return heat < HEAT_EPSILON ? 0 : heat;
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
 * Heat is removed in whole `amount`s only, so a fractional leftover (0.4 of a point) stays until more heat is added. Time only
 * counts while there is at least one whole `amount` to remove; once there is none the cycle restarts from 0 and waits.
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
  const whole = wholeCycles(current.heat, amount);
  if (!(whole >= 1)) return { heat: settle(Math.max(0, current.heat)), cooldownMs: 0 };
  const total = current.cooldownMs + deltaMs;
  const cycles = Math.floor(total / cycleMs);
  if (cycles >= whole) return { heat: settle(current.heat - whole * amount), cooldownMs: 0 };
  return { heat: settle(current.heat - cycles * amount), cooldownMs: total - cycles * cycleMs };
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
 * (or no whole point of heat is left) the cooldown goes on at `speed`. As in {@link coolHeat}, only whole `amount`s are removed. The boosted stretch is worked out first (it lasts until the
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
  let { heat, cooldownMs, moles } = current;
  if (!(wholeCycles(heat, amount) >= 1)) return { heat: settle(Math.max(0, heat)), cooldownMs: 0, moles };
  let time = deltaMs;
  const fast = speed * (1 + boost);
  if (moles > 0 && boost > 0) {
    const limit = Math.min(Math.ceil(moles / amount), wholeCycles(heat, amount)); // cycles the boost can last
    const progress = cooldownMs + time * fast;
    const cycles = Math.floor(progress / cycleMs);
    if (cycles < limit) {
      const cooled = cycles * amount;
      return { heat: settle(heat - cooled), cooldownMs: progress - cycles * cycleMs, moles: Math.max(0, moles - cooled) };
    }
    // The Moles or the heat run out within this step: finish those cycles boosted, then carry on at normal pace.
    const timeUsed = Math.max(0, (limit * cycleMs - cooldownMs) / fast);
    const cooled = limit * amount;
    heat = settle(heat - cooled);
    moles = Math.max(0, moles - cooled);
    cooldownMs = 0;
    time = Math.max(0, time - timeUsed);
    if (!(wholeCycles(heat, amount) >= 1)) return { heat, cooldownMs: 0, moles };
  }
  const rest = coolHeat({ heat, cooldownMs }, time * speed, cycleMs, amount);
  return { heat: rest.heat, cooldownMs: rest.cooldownMs, moles };
}
