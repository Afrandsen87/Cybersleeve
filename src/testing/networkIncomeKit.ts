/**
 * Economy passive-income fixture using the shared test configuration through gameKit.
 * Called by: economy/creditsPerSecond.test.ts. Calls: game, NetworkSystem.
 */
import { NetworkSystem } from '../core/economy/network';
import type { GameState } from '../core/types';
import { num, numberFactory } from '../numbers';
import { game } from './gameKit';

/**
 * Builds a live network fixture with optional injected synthetic income.
 * Called by: creditsPerSecond tests. Calls: game, NetworkSystem, GameEngine.passiveCreditsPerSecond.
 * @param nodes initial network nodes
 * @param syntheticIncome optional extra credits per second; null means no synthetic service
 * @returns engine, writable state and income system; no timers are started
 */
export function networkIncomeFixture(nodes = 0, syntheticIncome: number | null = null) {
  const engine = game();
  const state = engine.getState() as GameState;
  state.sleeve.network = num(nodes);
  const network = new NetworkSystem(
    state,
    { passiveCreditsPerSecond: () => engine.passiveCreditsPerSecond(), networkGrowthRate: () => 0 },
    numberFactory,
    syntheticIncome === null ? null : { creditsPerSecond: () => num(syntheticIncome) },
  );
  return { engine, state, network };
}
