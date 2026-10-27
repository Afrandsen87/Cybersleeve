/**
 * @module core
 *
 * The pace at which heat cools right now: the skill speed, the idle bonus (Quiet Hours) and what Moles do (spent, or aggregated).
 */

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
  const idleSpeed = inputs.speed * (inputs.idle ? inputs.idleFactor : 1);
  if (inputs.moleAggregation === null) return { speed: idleSpeed, boost: inputs.boost };
  const orders = inputs.moles > 1 ? Math.log10(inputs.moles) : 0;
  return { speed: idleSpeed * (1 + inputs.moleAggregation) ** orders, boost: 0 };
}
