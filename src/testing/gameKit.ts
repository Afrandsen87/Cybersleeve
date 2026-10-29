/**
 * Shared test setup: a game built from the test config.
 *
 * Purpose: one definition of the "engine on `testConfig` with a few overrides" helper that ten test files each copied.
 * Kits in this folder (see each file's header): `testConfig` (config, `setCredits`, `setSleeveXp`), `gameKit` (this file),
 * `cyberneticsKit` (`buy`, actions `a`/`net`), `automationKit`, `sleeveLevelsKit`, `skillViews`, `invariants`, `random`, `fakes`, `hover`.
 * Called by: tests. Calls: `createGame`, `createConfig`.
 */
import { createGame } from '../app/createGame';
import { createConfig } from '../core/config/config';
import type { GameEngine } from '../core/engine/engine';
import type { GameConfig } from '../core/types';
import { num } from '../numbers';
import { seededRandom } from './random';
import { setCredits, testConfig } from './testConfig';

/**
 * Builds an engine on the test config with some fields overridden (see `createConfig`).
 *
 * @param overrides partial config merged over `testConfig`
 * @returns a fresh engine with its default random source
 */
export const game = (overrides = {}): GameEngine => createGame({ config: createConfig(testConfig, overrides) });

/**
 * Builds an engine on a given config with a seeded random source, 1,000,000 credits, and the listed buyables bought in order.
 *
 * @param config the full configuration to play
 * @param seed seed of the random source (default 1), so chance draws are repeatable
 * @param purchases buyable ids to buy first, in order (each must succeed)
 * @returns the engine
 */
export function seededGame(config: GameConfig, seed = 1, purchases: readonly string[] = []): GameEngine {
  const g = createGame({ config, random: seededRandom(seed) });
  setCredits(g, num(1_000_000));
  for (const id of purchases) {
    if (g.buy(id) !== 'purchased') throw new Error(`seededGame: could not buy "${id}"`);
  }
  return g;
}
