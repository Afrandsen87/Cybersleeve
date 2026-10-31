/** Testing kit for effective levels and run ICE. Extends testConfig, never live tuning.
 * Called by: effectiveLevel/runIce tests and batching tests. Calls: createConfig, buy.
 */
import { createConfig } from '../core';
import type { GameEngine, GameState } from '../core';
import { num } from '../numbers';
import { buy } from './cyberneticsKit';
import { networkAction, testConfig } from './testConfig';

/** Configured derived consumers, transfer bonus and distinct sleeve skills.
 * Called by: effective-level tests. Calls: createConfig, buy. No mutation.
 */
export function effectiveLevelConfig() {
  return createConfig(testConfig, {
    actions: [{ ...testConfig.actions[0]!, startCost: { currency: 'networkNodes', fractionOfBalance: 0.1 } }, networkAction],
    buyables: [
      ...testConfig.buyables,
      buy({ id: 'transfer', effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: 'net', targetActionId: 'a' } }),
      buy({ id: 'networked', requiresSleeveSkills: 2, effect: { kind: 'levelBonusFromSleeveSkills', targetActionId: 'a' } }),
      buy({ id: 'skill1', currency: 'resleevePoints', effect: { kind: 'placeholder' } }),
      buy({ id: 'skill2', currency: 'resleevePoints', effect: { kind: 'placeholder' } }),
      buy({ id: 'ice', effect: { kind: 'iceRatingFromActionLevel', sourceActionId: 'a', perLevel: 10 } }),
      buy({ id: 'growth', effect: { kind: 'networkGrowthFromActionLevel', sourceActionId: 'a', percentPerLevel: 1 } }),
      buy({
        id: 'reward',
        effect: { kind: 'rewardMultiplierFromActionLevel', sourceActionId: 'a', targetActionId: 'net', coefficient: 2, scale: 1 },
      }),
      buy({ id: 'cost', actionId: 'a', effect: { kind: 'startCostReduction', perLevel: 0.1 } }),
      buy({ id: 'safety', actionId: 'a', maxPurchases: Infinity, effect: { kind: 'runIceChance', chance: 0.05, perCopy: 0.01 } }),
    ],
    network: { creditsPerNodePerSecond: 0 },
  });
}

/** Mutable state access for explicit test fixtures only.
 * Called by: effectiveLevel/runIce tests. Calls: GameEngine.getState. Returns live test state.
 */
export function effectiveState(game: GameEngine): GameState {
  return game.getState() as GameState;
}

/** Owns selected test effects and grants two real action levels, three source sleeve levels.
 * Called by: effectiveLevel tests. Calls: effectiveState. Mutates fixture state only.
 */
export function prepareEffectiveLevels(game: GameEngine): GameState {
  const state = effectiveState(game);
  Object.assign(state.sleeve.purchased, { ice: 1, growth: 1, reward: 1, cost: 1 });
  state.sleeve.actions['a']!.xp = num(110);
  state.sleeve.actions['net']!.sleeveXp = num(1110);
  return state;
}
