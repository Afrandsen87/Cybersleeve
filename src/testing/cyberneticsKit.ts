/**
 * @module testing
 *
 * Test setup for the cybernetics skills: a small configuration with two actions and helpers to build a game on it.
 *
 * @remarks
 * Used by `core/cybernetics*.test.ts`, `core/linkedPayouts.test.ts` and `core/levelRewardFactor.test.ts`. The unit-test config
 * (`testConfig.ts`) is extended, never the real content: the tests state their own numbers.
 */
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition, type GameConfig } from '../core';
import { num } from '../numbers';
import { seededRandom } from './random';
import { networkAction, setCredits, testConfig } from './testConfig';

/** A buyable with defaults filled in (1 credit, no description), so a test lists only what it cares about. */
export const buy = (b: Partial<BuyableDefinition> & Pick<BuyableDefinition, 'id' | 'effect'>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(1),
  ...b,
});

/**
 * Two actions: `a` (10 s per run, 0.5 credits, 1 XP) and `net` (20 s per run, 1 network node), both with levels out of reach so their
 * speed stays put. A `crit` buyable gives a 100% critical chance and an `auto` buyable restarts `a`. No node income.
 *
 * @param extra buyables the test adds
 */
export function cyberneticsConfig(extra: BuyableDefinition[] = []): GameConfig {
  return createConfig(testConfig, {
    actions: [...testConfig.actions, networkAction],
    buyables: [
      ...testConfig.buyables,
      buy({ id: 'crit', maxPurchases: Infinity, effect: { kind: 'criticalChance', chance: 1 } }),
      ...extra,
    ],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
}

/** A game on `config`, seeded, with a million credits. */
export function cyberneticsGame(config: GameConfig = cyberneticsConfig(), seed = 1) {
  const g = createGame({ config, random: seededRandom(seed) });
  setCredits(g, num(1_000_000));
  return g;
}

/** The engine the helpers build. */
export type CyberneticsGame = ReturnType<typeof cyberneticsGame>;

/** Credits held. */
export const creditsOf = (g: CyberneticsGame): number => g.getState().wallet.credits.toNumber();

/** Network nodes held. */
export const nodesOf = (g: CyberneticsGame): number => g.getState().sleeve.network.toNumber();

/** Action XP of an action. */
export const xpOf = (g: CyberneticsGame, id: string): number => g.getState().sleeve.actions[id]!.xp.toNumber();

/** Puts augments of the given rarities (a count each) on an action, as if they had been applied. */
export function setAugments(g: CyberneticsGame, actionId: string, applied: Record<string, number>): void {
  (g.getState().sleeve.actions[actionId] as { augments: Record<string, number> }).augments = { ...applied };
}
