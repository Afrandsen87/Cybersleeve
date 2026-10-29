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
 * The heat the cooldown can take away: whole points (or whole `amount`s when a cycle removes less than a point), never a fraction of one.
 *
 * Called by: {@link cyclesNeeded}, {@link coolHeat}, {@link coolHeatBoosted}.
 *
 * @param heat heat points (>= 0)
 * @param amount heat removed per full cycle (> 0)
 * @returns `heat` rounded down to a multiple of `min(1, amount)`, tolerant of tiny floating-point shortfalls (0 when there is less than one)
 */
function removable(heat: number, amount: number): number {
  const unit = Math.min(1, amount);
  return Math.floor(heat / unit + HEAT_EPSILON) * unit;
}

/**
 * How many cooldown cycles it takes to remove everything {@link removable}: each cycle removes `amount`, and the last one only what is left.
 *
 * Called by: {@link coolHeat}, {@link coolHeatBoosted}.
 *
 * @param points the removable heat (>= 0)
 * @param amount heat removed per full cycle (> 0)
 * @returns `ceil(points / amount)`, 0 when there is nothing to remove
 */
function cyclesNeeded(points: number, amount: number): number {
  return Math.ceil(points / amount - HEAT_EPSILON);
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
 * @param maxShare the most the tax may take (`heatTaxCap` buyables; default 1 = no cap, 0.5 = never more than half)
 * @returns `1 - heat * (1 - reduction) * taxPerPoint`, never below `1 - maxShare` (and never below 0). With 1% per point and no
 *   reduction, 100 heat keeps nothing; with a 50% reduction, credits only stop at 200 heat; with a cap of 0.5 half is always kept.
 */
export function heatTaxFactor(heat: number, reduction: number, taxPerPoint: number, maxShare = 1): number {
  if (!(heat > 0)) return 1;
  return Math.max(0, 1 - maxShare, 1 - heat * (1 - reduction) * taxPerPoint);
}

/**
 * Advances the heat cooldown in closed form: every full `cycleMs` removes `amount` heat.
 *
 * @remarks
 * Heat is removed in whole points only, so a fractional leftover (0.4 of a point) stays until more heat is added. A cycle removes
 * `amount`, but never more than the whole points that are left: with `amount` 5 and 3.5 heat the cycle takes 3 and leaves 0.5, so a big
 * `amount` can never strand heat. Time only counts while there is at least one whole point to remove; once there is none the cycle
 * restarts from 0 and waits. The cost does not depend on `deltaMs`, so long ticks are cheap.
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
  const points = removable(current.heat, amount);
  if (!(points > 0)) return { heat: settle(Math.max(0, current.heat)), cooldownMs: 0 };
  const total = current.cooldownMs + deltaMs;
  const cycles = Math.floor(total / cycleMs);
  if (cycles >= cyclesNeeded(points, amount)) return { heat: settle(current.heat - points), cooldownMs: 0 };
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
 * (or no whole point of heat is left) the cooldown goes on at `speed`. As in {@link coolHeat}, only whole points are removed and the last cycle takes only what is left. The boosted stretch is worked out first (it lasts until the
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
  if (!(removable(heat, amount) > 0)) return { heat: settle(Math.max(0, heat)), cooldownMs: 0, moles };
  let time = deltaMs;
  const fast = speed * (1 + boost);
  if (moles > 0 && boost > 0) {
    const points = removable(heat, amount);
    const limit = Math.min(Math.ceil(moles / amount), cyclesNeeded(points, amount)); // cycles the boost can last
    const progress = cooldownMs + time * fast;
    const cycles = Math.floor(progress / cycleMs);
    if (cycles < limit) {
      const cooled = cycles * amount;
      return { heat: settle(heat - cooled), cooldownMs: progress - cycles * cycleMs, moles: Math.max(0, moles - cooled) };
    }
    // The Moles or the heat run out within this step: finish those cycles boosted, then carry on at normal pace.
    const timeUsed = Math.max(0, (limit * cycleMs - cooldownMs) / fast);
    const cooled = Math.min(limit * amount, points);
    heat = settle(heat - cooled);
    moles = Math.max(0, moles - cooled);
    cooldownMs = 0;
    time = Math.max(0, time - timeUsed);
    if (!(removable(heat, amount) > 0)) return { heat, cooldownMs: 0, moles };
  }
  const rest = coolHeat({ heat, cooldownMs }, time * speed, cycleMs, amount);
  return { heat: rest.heat, cooldownMs: rest.cooldownMs, moles };
}
