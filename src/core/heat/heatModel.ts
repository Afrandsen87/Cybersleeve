/**
 * @module core
 *
 * The heat model: the numbers the heat rules produce, in one place, so the engine and the interface read the same values.
 *
 * @remarks
 * The cooldown cycle length, whether the cooldown runs right now, the share of income the tax takes, the heat at which the tax
 * stops everything and the speed Moles give with Deep Cover were each worked out once in the engine and again in the interface
 * (`sleeveView.ts`, `moleBonus.ts`). They are pure functions here; the interface only formats their results.
 * Called by: `heat/cooldowns.ts`, `heat/heatPace.ts`, `ui/view/sleeveView.ts`, `ui/view/moleBonus.ts`.
 * Calls: `kernel/curves` (`orders`).
 */
import { orders } from '../kernel/curves';
import type { SleeveConfig } from '../types';

/**
 * Length of one heat cooldown cycle before skills: `sleeve.heatCooldownMs` divided by `1 + legendHeatSpeedup x Legend`.
 *
 * @param sleeve reads `heatCooldownMs` and `legendHeatSpeedup`
 * @param legend the Legend held now
 * @returns milliseconds (> 0 for valid content)
 */
export function cycleMs(sleeve: Pick<SleeveConfig, 'heatCooldownMs' | 'legendHeatSpeedup'>, legend: number): number {
  return sleeve.heatCooldownMs / (1 + sleeve.legendHeatSpeedup * legend);
}

/**
 * Whether the cooldown is running: it waits until there is a whole `amount` of heat to remove.
 *
 * @param heat current heat
 * @param amount heat removed per cycle (`SleeveStats.heatCooldownAmount`)
 */
export function coolsNow(heat: number, amount: number): boolean {
  return heat >= amount;
}

/**
 * The share (0..1) of earned credits the heat tax takes: `heat x (1 - reduction) x taxPerPoint`, at most `maxShare`.
 *
 * @param heat current heat
 * @param reduction share of the heat's effect removed by ICE Rating (0..1)
 * @param taxPerPoint share one heat point takes (`sleeve.heatTaxPerPoint`)
 * @param maxShare the most the tax may take (`heatTaxCap`; 1 = no cap)
 * @returns the share taken (not clamped below, so it follows the heat)
 */
export function heatTaxShare(heat: number, reduction: number, taxPerPoint: number, maxShare: number): number {
  return Math.min(maxShare, heat * (1 - reduction) * taxPerPoint);
}

/**
 * The heat at which the tax takes everything, or `null` when it never does (a cap below 1, no tax, or full ICE reduction).
 *
 * @param reduction share of the heat's effect removed by ICE Rating (0..1)
 * @param taxPerPoint share one heat point takes
 * @param maxShare the tax cap (1 = none)
 */
export function heatStopPoint(reduction: number, taxPerPoint: number, maxShare: number): number | null {
  const keep = 1 - reduction;
  return maxShare >= 1 && keep > 0 && taxPerPoint > 0 ? 1 / taxPerPoint / keep : null;
}

/**
 * The factor Moles give heat cooling with Deep Cover: `(1 + bonusPerOrder) ^ orders(moles)`; 1 for 1 Mole or fewer.
 *
 * @param bonusPerOrder the skill's bonus per order of magnitude of Moles (`moleAggregation`)
 * @param moles Moles held
 * @returns a factor >= 1
 */
export function moleSpeedFactor(bonusPerOrder: number, moles: number): number {
  return (1 + bonusPerOrder) ** orders(moles);
}
