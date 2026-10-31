/**
 * @module testing
 * Automation context: shared deterministic permission, Back Channel and save test setup.
 * Called by: rarity automation tests, batching tests and UI fork tests. Calls: createConfig, createGame.
 */
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition, type GameState } from '../core';
import { num } from '../numbers';
import { autosaleSkills } from '../content/buyables/skillBranches/autosaleLane';
import { testConfig } from './testConfig';

/** Automation context: same stable tree edges, independent test names and no external reveal prerequisites. */
export const raritySkills: BuyableDefinition[] = autosaleSkills.map((b) => ({ ...b, requires: [] }));
/** Automation context: test content, with cooling disabled to compare batches without a tick-dependent heat consumer. */
export const rarityConfig = createConfig(testConfig, {
  items: {
    ...testConfig.items,
    rarities: ['common', 'uncommon', 'rare', 'legendary', 'crisis'].map((id) => ({ id, name: id, sellValue: num(10), sellSeconds: 0 })),
  },
  network: { creditsPerNodePerSecond: 0 },
  sleeve: { heatCooldownMs: 1e15 },
  automation: { autoBurnCeiling: 10 },
  buyables: [
    ...testConfig.buyables,
    ...raritySkills,
    { id: 'core', name: 'Core', description: '', cost: num(1), maxPurchases: Infinity, effect: { kind: 'automationPoints', perCopy: 1 } },
    {
      id: 'channel',
      name: 'Channel',
      description: '',
      cost: num(1),
      effect: { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 },
    },
    { id: 'tiered', name: 'Tiered', description: '', cost: num(1), effect: { kind: 'backChannelRarityScaling', itemId: 'file' } },
  ],
});

/** Automation context: builds a funded game with selected stable slots owned; optional manual channel. Mutates only its fresh state. */
export function rarityGame(slots: readonly number[] = [], channel = true) {
  const g = createGame({
    config: rarityConfig,
    random: () => {
      throw new Error('Back Channel must not draw randomness');
    },
  });
  const state = g.getState();
  const purchased = state.sleeve.purchased as Record<string, number>;
  purchased['core'] = 20;
  for (const slot of slots) purchased[`skill-autosale-${slot}`] = 1;
  if (channel) {
    purchased['channel'] = 1;
    purchased['tiered'] = 1;
  }
  return g;
}

/** Automation context: mutable state access for fixture setup only. Called by: rarity tests. Calls: getState. */
export function rarityState(g: ReturnType<typeof rarityGame>): GameState {
  return g.getState() as GameState;
}
