/**
 * @module ui
 *
 * Whether the player owns a purchase that makes an item drop. The one owner of "drop source owned", read by the Augment button gate.
 *
 * @remarks
 * Called by: `modeViews.ts`. Calls: nothing outside `core` types. Pure: no DOM, no state of its own.
 */
import type { GameConfig } from '../../core';

/**
 * Whether any owned buyable has an `itemDrop` effect for the item (data-driven: it reads the effect, never a buyable id).
 *
 * Called by: `augmentView`.
 *
 * @param config game configuration (the buyables)
 * @param itemId the item that drops
 * @param owned copies owned of a buyable id
 */
export function dropSourceOwned(config: GameConfig, itemId: string, owned: (buyableId: string) => number): boolean {
  return config.buyables.some((b) => b.effect.kind === 'itemDrop' && b.effect.drop.itemId === itemId && owned(b.id) > 0);
}
