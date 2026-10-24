/**
 * @module core
 *
 * The two timed decays of the sleeve: heat cools down, and Infamy wears off.
 */
import { coolHeat } from './heat';
import type { GameState, SleeveConfig } from './types';

/**
 * Cools heat. Each point of Infamy makes a cooldown cycle `sleeve.infamyHeatSlowdown` longer (using the Infamy held now).
 *
 * Called by: `engine.ts`. Calls: `coolHeat`.
 *
 * @param state state to mutate (`heat`, `heatCooldownMs`)
 * @param sleeve cycle length, amount per cycle and the Infamy slowdown
 * @param deltaMs game time in milliseconds
 */
export function coolDownHeat(state: GameState, sleeve: SleeveConfig, deltaMs: number): void {
  const cycleMs = sleeve.heatCooldownMs * (1 + sleeve.infamyHeatSlowdown * state.infamy);
  const cooled = coolHeat({ heat: state.heat, cooldownMs: state.heatCooldownMs }, deltaMs, cycleMs, sleeve.heatCooldownAmount);
  state.heat = cooled.heat;
  state.heatCooldownMs = cooled.cooldownMs;
}

/**
 * Lets Infamy fall by exactly 1 each time a `sleeve.infamyDecayPeriodMs` cycle completes (the same cycle mechanics as heat).
 *
 * Called by: `engine.ts`. Calls: `coolHeat`.
 *
 * @param state state to mutate (`infamy`, `infamyCooldownMs`)
 * @param sleeve reads `infamyDecayPeriodMs`
 * @param deltaMs game time in milliseconds
 */
export function decayInfamy(state: GameState, sleeve: SleeveConfig, deltaMs: number): void {
  const cooled = coolHeat({ heat: state.infamy, cooldownMs: state.infamyCooldownMs }, deltaMs, sleeve.infamyDecayPeriodMs, 1);
  state.infamy = cooled.heat;
  state.infamyCooldownMs = cooled.cooldownMs;
}
