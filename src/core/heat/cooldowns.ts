/**
 * @module core
 *
 * The two timed decays of the sleeve: heat cools down, and Legend wears off.
 */
import { coolHeat, coolHeatBoosted } from './heat';
import { cycleMs } from './heatModel';
import type { GameState, SleeveConfig } from '../types';

/**
 * Cools heat. Each point of Legend makes a cooldown cycle `sleeve.legendHeatSpeedup` faster (the cycle is divided by `1 + speedup x Legend`, using the Legend held now); skills
 * make it faster (`speed`), and while Moles remain it is faster still (`boost`), each point of heat cooled using one Mole.
 *
 * Called by: `engine.ts`. Calls: `coolHeatBoosted`.
 *
 * @param state state to mutate (`heat`, `heatCooldownMs`, `moles`)
 * @param sleeve cycle length, amount per cycle and the Legend speedup
 * @param deltaMs game time in milliseconds
 * @param speed how many times as fast heat cools from skills (default 1)
 * @param boost the extra speed while Moles remain (default 0)
 * @param amount heat removed per completed cycle (default `sleeve.heatCooldownAmount`; skills can raise it)
 */
export function coolDownHeat(
  state: GameState,
  sleeve: SleeveConfig,
  deltaMs: number,
  speed = 1,
  boost = 0,
  amount = sleeve.heatCooldownAmount,
): void {
  const cooled = coolHeatBoosted(
    { heat: state.sleeve.heat, cooldownMs: state.sleeve.heatCooldownMs, moles: state.sleeve.moles },
    deltaMs,
    cycleMs(sleeve, state.sleeve.legend),
    amount,
    speed,
    boost,
  );
  state.sleeve.heat = cooled.heat;
  state.sleeve.heatCooldownMs = cooled.cooldownMs;
  state.sleeve.moles = cooled.moles;
}

/**
 * Lets Legend fall by exactly 1 each time a `sleeve.legendDecayPeriodMs` cycle completes (the same cycle mechanics as heat).
 *
 * Called by: `engine.ts`. Calls: `coolHeat`.
 *
 * @param state state to mutate (`legend`, `legendCooldownMs`)
 * @param sleeve reads `legendDecayPeriodMs`
 * @param deltaMs game time in milliseconds
 */
export function decayLegend(state: GameState, sleeve: SleeveConfig, deltaMs: number): void {
  const cooled = coolHeat({ heat: state.sleeve.legend, cooldownMs: state.sleeve.legendCooldownMs }, deltaMs, sleeve.legendDecayPeriodMs, 1);
  state.sleeve.legend = cooled.heat;
  state.sleeve.legendCooldownMs = cooled.cooldownMs;
}
