/**
 * @module core
 *
 * The pace at which heat cools right now: the skill speed, the idle bonus (Quiet Hours) and what Moles do (spent, or aggregated).
 */

import { moleSpeedFactor } from './heatModel';

/** What decides the cooling pace. */
export interface CoolingPaceInputs {
  /** How many times as fast heat cools from `heatCooldownSpeed` skills (>= 1). */
  readonly speed: number;
  /** The extra speed while Moles remain, from `backChannel` (0.5 = 50 percent; >= 0). */
  readonly boost: number;
  /** Moles held (>= 0). */
  readonly moles: number;
  /** True when no action is in progress, or only actions that `idleHeatCooldownAction` lets count as idle. */
  readonly idle: boolean;
  /** How many times as fast heat cools while idle (>= 1; 1 without Quiet Hours). */
  readonly idleFactor: number;
  /** Cooling gained per order of magnitude of Moles, or `null` while Moles are spent (no Deep Cover). */
  readonly moleAggregation: number | null;
}

/** The pace to hand to the cooldown (see `coolDownHeat`). */
export interface CoolingPace {
  /** How many times as fast heat cools, whatever the Moles do. */
  readonly speed: number;
  /** The extra speed while Moles remain, with each point cooled using one Mole. Always 0 while Moles are aggregated. */
  readonly boost: number;
}

/**
 * The skill cooling speed with the idle bonus (Quiet Hours) applied while idle. The one owner of that multiplication.
 *
 * Called by: {@link coolingPace}, `ui/view/sleeveView.ts` (the displayed cooldown time). Calls: nothing.
 *
 * @param speed the skill speed (`heatCooldownSpeed`, >= 1)
 * @param idle true when no action is in progress
 * @param idleFactor the Quiet Hours factor (`idleHeatCooldown`, >= 1)
 * @returns the speed to cool with
 */
export function idleAdjustedSpeed(speed: number, idle: boolean, idleFactor: number): number {
  return speed * (idle ? idleFactor : 1);
}

/**
 * How many times as fast as the base cycle heat actually cools right now: the {@link coolingPace} speed, times `1 + boost` while
 * Moles remain. The one owner of the displayed cooldown time.
 *
 * Called by: `ui/view/sleeveView.ts`. Calls: {@link coolingPace}.
 *
 * @param inputs the same inputs the engine hands to {@link coolingPace}
 * @returns a factor >= 1
 */
export function effectiveCoolingSpeed(inputs: CoolingPaceInputs): number {
  const pace = coolingPace(inputs);
  return pace.speed * (inputs.moles > 0 && pace.boost > 0 ? 1 + pace.boost : 1);
}

/**
 * The cooling pace for this slice of time.
 *
 * @remarks
 * Idle cooling multiplies the skill speed. Without Deep Cover, Moles keep their own boost and are spent. With Deep Cover they are never
 * spent: the boost is dropped and the speed is multiplied by `(1 + bonusPerOrder) ^ log10(moles)` instead, so 10 Moles are worth one
 * step of the bonus, 100 two steps, and 1 Mole or fewer nothing. Pure.
 *
 * Called by: `engine.ts` (`GameEngine.advance`). Calls: nothing.
 *
 * @param inputs the skill speed, the Mole boost, the Moles held and whether the sleeve is idle
 * @returns the speed and the boost to cool with
 */
export function coolingPace(inputs: CoolingPaceInputs): CoolingPace {
  const idleSpeed = idleAdjustedSpeed(inputs.speed, inputs.idle, inputs.idleFactor);
  if (inputs.moleAggregation === null) return { speed: idleSpeed, boost: inputs.boost };
  return { speed: idleSpeed * moleSpeedFactor(inputs.moleAggregation, inputs.moles), boost: 0 };
}
