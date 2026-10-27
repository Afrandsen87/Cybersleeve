/**
 * Shared setup of the Overclock, Focus, square and item tile tests: a small configuration and helpers to own purchases and read the state.
 */
import { expect } from 'vitest';
import type { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig, type GameConfig } from '../core';
import { num } from '../numbers';
import { networkAction, setCredits, testConfig } from '../testing/testConfig';
import type { SpeedControl } from './dom';

/** The fast-forward switch as the UI sees it: off, factor 1. */
export const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

/** Builds a buyable from the fields a test cares about; the rest get plain defaults. */
export const buyable = (b: Pick<BuyableDefinition, 'id' | 'effect'> & Partial<BuyableDefinition>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(1),
  ...b,
});

/**
 * Test action 'a' has Overclock (+50%, 1 heat/min), an auto-run and unlocks for Overclock and Focus; 'net' has a Focus unlock only.
 * Leads are an item, 5% of the heat each. Levels stay out of reach.
 */
export const config: GameConfig = (() => {
  const base = createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      buyable({ id: 'oc-a', actionId: 'a', effect: { kind: 'overclockUnlock' } }),
      buyable({ id: 'fo-a', actionId: 'a', effect: { kind: 'focusUnlock' } }),
      buyable({ id: 'fo-net', actionId: 'net', effect: { kind: 'focusUnlock' } }),
      buyable({ id: 'ocs', maxPurchases: Infinity, costGrowth: 10, effect: { kind: 'overclockStrength', perCopy: 0.1 } }),
      buyable({ id: 'slots', maxPurchases: 2, effect: { kind: 'focusSlots', perCopy: 1 } }),
    ],
    items: {
      ...testConfig.items,
      definitions: [...testConfig.items.definitions, { id: 'lead', name: 'Lead', sellable: false, hasRarity: false }],
      burnLead: { itemId: 'lead', heatFraction: 0.05 },
    },
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
  });
  return createConfig(base, { actions: [{ ...base.actions[0]!, overclock: { speedBonus: 0.5, heatPerMinute: 1 } }, networkAction] });
})();

/** The same configuration with an Augment schematic item (1% per item). */
export const augmentConfig: GameConfig = createConfig(config, {
  items: { ...config.items, augment: { itemId: 'file', xpBonusPerItem: 0.01 } },
});

/** Gives the game plenty of credits and buys a purchase the given number of times. */
export const own = (g: ReturnType<typeof createGame>, id: string, times = 1): void => {
  setCredits(g, num(1e9));
  for (let i = 0; i < times; i++) expect(g.buy(id)).toBe('purchased');
};

/** The state with the loosely typed fields the tests write to (heat, inventory). */
export const state = (g: ReturnType<typeof createGame>) =>
  g.getState() as unknown as { heat: number; inventory: Record<string, Record<string, number>> };

/** Matches a negation in a tooltip, to check that a text says a thing is not so. */
export const NOT = /\b(not|never|no)\b/i;
