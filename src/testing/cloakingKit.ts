/**
 * @module testing
 * Shared heat/economy/effects test fixture for Cloaking and its re-sleeve exception.
 * Called by: cloakingProtocols.test.ts. Calls: createConfig, createGame, testConfig.
 */
import { createGame } from '../app/createGame';
import { createConfig, type GameState } from '../core';
import { buy } from './cyberneticsKit';
import { testConfig } from './testConfig';

/**
 * Builds a game with three distinct sleeve skills, Cloaking, and an ordinary credit-paid ICE multiplier.
 * Called by: cloakingProtocols.test.ts. Calls: createConfig, createGame.
 * @returns an independent game, its config and mutable test state; mutates only the new game
 */
export function cloakingGame() {
  const config = createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      buy({ id: 'cloak', maxPurchases: 1, effect: { kind: 'heatReductionPerSleeveSkill', perSkill: 0.03 } }),
      buy({ id: 'boost', effect: { kind: 'iceRatingMultiplier', factor: 2 } }),
      ...['s1', 's2', 's3'].map((id) => buy({ id, currency: 'resleevePoints', effect: { kind: 'placeholder' } })),
    ],
  });
  const game = createGame({ config });
  const state = game.getState() as GameState;
  state.sleeve.heat = 25;
  return { config, game, state };
}
