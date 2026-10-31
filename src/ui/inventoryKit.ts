/** @module testing
 * Shared inventory fixtures, based on testConfig; stock maintains the seen-item invariant.
 * Called by: inventory and stash tests. Calls: createConfig, num.
 */
import { createConfig, type BuyableDefinition } from '../core';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
const harvest: BuyableDefinition = {
  id: 'harvest',
  name: 'Harvest',
  description: '',
  actionId: 'a',
  cost: num(5),
  effect: { kind: 'itemDrop', drop: { itemId: 'file', chance: 1, rarityWeights: { common: 1 } } },
};
/** Inventory drop fixture. Called by: inventory tests. Calls: createConfig. */
export const config = createConfig(testConfig, { buyables: [...testConfig.buyables, harvest] });

/** Holds stacks and marks them seen. Called by: inventory tests. Calls: getState. Mutates test inventory. */
export const stock = (g: { getState(): unknown }, inventory: Record<string, Record<string, number>>): void => {
  const wallet = (g.getState() as unknown as { wallet: { inventory: unknown; seenItems: Record<string, Record<string, true>> } }).wallet;
  wallet.inventory = inventory;
  for (const [item, stacks] of Object.entries(inventory)) for (const r of Object.keys(stacks)) (wallet.seenItems[item] ??= {})[r] = true;
};

/** Marks stacks seen without holding them. Called by: inventory tests. Calls: getState. Mutates test seen items. */
export const see = (g: { getState(): unknown }, seen: Record<string, Record<string, true>>): void => {
  (g.getState() as unknown as { wallet: { seenItems: unknown } }).wallet.seenItems = seen;
};

/** Sellable files plus kept items with and without rarity. Called by: stash tests. Calls: createConfig. */
export const stashConfig = createConfig(testConfig, {
  items: {
    ...testConfig.items,
    definitions: [
      ...testConfig.items.definitions,
      { id: 'kept', name: 'Kept', sellable: false },
      { id: 'tool', name: 'Tool', sellable: false, hasRarity: false },
      { id: 'other', name: 'Other' },
    ],
  },
});
