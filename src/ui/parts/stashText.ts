/** @module ui
 * Stash wording types. Called by: UiText, inventoryView. Calls: nothing.
 */
/** Stash captions and formatted gains. Called by: inventoryView. Calls: nothing. */
export interface StashText {
  readonly consumable: string;
  /** Formats rarity names. Called by: inventoryView. Calls: nothing. */
  caption(rarityName: string): string;
  /** Signs formatted payouts. Called by: inventoryView. Calls: nothing. */
  gain(value: string): string;
}
