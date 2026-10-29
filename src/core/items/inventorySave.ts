/**
 * @module core
 *
 * The inventory's part of a save (wallet `inventory`).
 */
import { isRecord, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig, Wallet } from '../types';

/**
 * The inventory as it is saved: stacks that are used up (count 0) and items with no stack left are left out, the way
 * {@link readInventory} reads them back, so that saving, loading and saving again gives the same text.
 *
 * Called by: {@link inventorySavePart}. Calls: nothing.
 */
export function writeInventory(inventory: Readonly<Record<string, Readonly<Record<string, number>>>>): Wallet['inventory'] {
  const out: Wallet['inventory'] = {};
  for (const [item, stacks] of Object.entries(inventory)) {
    for (const [rarity, count] of Object.entries(stacks)) if (count > 0) (out[item] ??= {})[rarity] = count;
  }
  return out;
}

/**
 * Reads the inventory: only known items and rarities, whole counts above 0 (a save without one is an empty inventory).
 *
 * Called by: {@link inventorySavePart}. Calls: `readCount`.
 */
export function readInventory(v: unknown, items: GameConfig['items']): Wallet['inventory'] {
  const out: Wallet['inventory'] = {};
  if (!isRecord(v)) return out;
  for (const item of items.definitions) {
    const saved = v[item.id];
    if (!isRecord(saved)) continue;
    for (const rarity of items.rarities) {
      const count = Math.min(readCount(saved[rarity.id]), Number.MAX_SAFE_INTEGER);
      if (count > 0) (out[item.id] ??= {})[rarity.id] = count;
    }
  }
  return out;
}

/**
 * The inventory part. Must be read before the key toggles (a toggle stays on only while its key is held).
 *
 * Called by: `save/saveParts.ts`. Calls: {@link writeInventory}, {@link readInventory}.
 */
export const inventorySavePart: SavePart<Pick<GameConfig, 'items'>> = {
  name: 'inventory',
  write: (state) => ({ wallet: { inventory: writeInventory(state.wallet.inventory) } }),
  read: (state, raw, config) => {
    state.wallet.inventory = readInventory(raw.wallet['inventory'], config.items);
  },
};
