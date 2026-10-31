/**
 * @module testing
 * Automation context: deterministic dispersal fixtures extending the shared rarity automation kit.
 * Called by: dispersal tests. Calls: createConfig, createGame; never draws randomness.
 */
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition, type GameState } from '../core';
import { num } from '../numbers';
import { rarityConfig } from './rarityAutomationKit';

/** Automation context: fixture slot effects, independent of the real content's names and tuning. */
const effects: BuyableDefinition['effect'][] = [
  { kind: 'unlocksAutomation', feature: 'dispersal', dispersalSlots: 1, allowsDispersal: 'common' },
  { kind: 'dispersalSlots', count: 1 },
  { kind: 'allowsDispersal', rarity: 'uncommon' },
  { kind: 'dispersalSlots', count: 1 },
  { kind: 'dispersalSlots', count: 1 },
  { kind: 'allowsDispersal', rarity: 'rare' },
  { kind: 'dispersalSlots', count: 1 },
  { kind: 'allowsDispersal', rarity: 'legendary' },
  { kind: 'dispersalSlots', count: 1 },
];
/** Automation context: fixture content includes two available actions and one access-gated action. */
export const dispersalConfig = createConfig(rarityConfig, {
  actions: [
    ...rarityConfig.actions,
    { ...rarityConfig.actions[0]!, id: 'b', name: 'B' },
    { ...rarityConfig.actions[0]!, id: 'locked', name: 'Locked', requiredAccessLevel: 2 },
  ],
  items: {
    ...rarityConfig.items,
    definitions: [...rarityConfig.items.definitions, { id: 'schem', name: 'Schematic', sellable: false }],
    augment: { itemId: 'schem', xpBonusPerItem: 0.01 },
  },
  buyables: [
    ...rarityConfig.buyables,
    { id: 'auto-b', name: 'Auto B', description: '', actionId: 'b', cost: num(1), effect: { kind: 'autoRun' } },
    ...effects.map(
      (effect, i): BuyableDefinition => ({
        id: 'skill-dispersal-' + (i + 1),
        name: 'Dispersal ' + (i + 1),
        description: '',
        cost: num(1),
        currency: 'automationPoints',
        branch: 'dispersal',
        ...(i ? { parents: ['skill-dispersal-' + i] } : {}),
        effect,
      }),
    ),
  ],
});
/** Automation context: owns a prefix of the lane, funded with enough points; both available Auto-runs owned. */
export function dispersalGame(skills = 2, held: Record<string, number> = {}) {
  const g = createGame({
    config: dispersalConfig,
    random: () => {
      throw new Error('Dispersal must not draw randomness');
    },
  });
  const state = g.getState() as GameState;
  state.sleeve.purchased = { core: 20, auto: 1, 'auto-b': 1 };
  for (let slot = 1; slot <= skills; slot++) state.sleeve.purchased['skill-dispersal-' + slot] = 1;
  state.wallet.inventory['schem'] = { ...held };
  return g;
}
/** Automation context: mutable state access for deterministic fixture setup only. */
export function dispersalState(g: ReturnType<typeof dispersalGame>): GameState {
  return g.getState() as GameState;
}
/** Automation context: counts applied augments, retaining each rarity's identity in live state. */
export function applied(g: ReturnType<typeof dispersalGame>, id: string): number {
  return Object.values(g.getState().sleeve.actions[id]!.augments).reduce((total, count) => total + count, 0);
}
