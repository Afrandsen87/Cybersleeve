/**
 * @module core
 *
 * The two timed decays of the sleeve: heat cools down, and Infamy wears off.
 */
import { coolHeat, coolHeatBoosted } from './heat';
import type { GameState, SleeveConfig } from './types';

/**
 * Cools heat. Each point of Infamy makes a cooldown cycle `sleeve.infamyHeatSlowdown` longer (using the Infamy held now); skills
 * make it faster (`speed`), and while Moles remain it is faster still (`boost`), each point of heat cooled using one Mole.
 *
 * Called by: `engine.ts`. Calls: `coolHeatBoosted`.
 *
 * @param state state to mutate (`heat`, `heatCooldownMs`, `moles`)
 * @param sleeve cycle length, amount per cycle and the Infamy slowdown
 * @param deltaMs game time in milliseconds
 * @param speed how many times as fast heat cools from skills (default 1)
 * @param boost the extra speed while Moles remain (default 0)
 */
export function coolDownHeat(state: GameState, sleeve: SleeveConfig, deltaMs: number, speed = 1, boost = 0): void {
  const cycleMs = sleeve.heatCooldownMs * (1 + sleeve.infamyHeatSlowdown * state.infamy);
  const cooled = coolHeatBoosted(
    { heat: state.heat, cooldownMs: state.heatCooldownMs, moles: state.moles },
    deltaMs,
    cycleMs,
    sleeve.heatCooldownAmount,
    speed,
    boost,
  );
  state.heat = cooled.heat;
  state.heatCooldownMs = cooled.cooldownMs;
  state.moles = cooled.moles;
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
