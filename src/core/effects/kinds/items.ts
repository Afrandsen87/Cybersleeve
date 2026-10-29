/**
 * @module core
 *
 * Effects on items: drops, rarity weights and the back channel.
 *
 * Called by: `effects/kinds/index.ts` (the {@link BuyableEffect} union). Calls: nothing.
 */
import type { ItemDropRule, ItemId, RarityId } from '../../items/itemTypes';

/** Effects on items: drops, rarity weights and the back channel. */
export type ItemEffect =
  /** Completed runs of the buyable's action may drop an item, as described by `drop`. Applies once, whatever the number of copies. */
  | { readonly kind: 'itemDrop'; readonly drop: ItemDropRule }
  /**
   * Hacking Proficiency shifts the drop ratios of the buyable's action towards the rarer rarities: for every whole order of
   * magnitude of proficiency (`floor(log10)`, none below 10) `fractionPerOrder` of each rarity's weight moves to the next rarity.
   * The amounts are worked out up front for all rarities and moved at once (see `shiftWeights`). Applies once, whatever the number of copies.
   */
  | { readonly kind: 'rarityShiftFromProficiency'; readonly fractionPerOrder: number }
  /** Multiplies the drop chance (the chance of a drop at all) of every drop rule of `itemId` by `factor` per copy; the result never exceeds 1. */
  | { readonly kind: 'itemDropChanceMultiplier'; readonly itemId: ItemId; readonly factor: number }
  /** Node payout is multiplied by `1 + perItem x` the number of `itemId` items of `rarityId` held, per copy. */
  | { readonly kind: 'nodePayoutFromItems'; readonly itemId: ItemId; readonly rarityId: RarityId; readonly perItem: number }
  /**
   * Lets the player give up items of `itemId` / `rarityId` for Moles: `molesPerItem` Moles each. While Moles remain, heat cools
   * `cooldownBoost` (0.5 = 50 percent) faster, and every point of heat cooled uses up one Mole.
   */
  | {
      readonly kind: 'backChannel';
      readonly itemId: ItemId;
      readonly rarityId: RarityId;
      readonly molesPerItem: number;
      readonly cooldownBoost: number;
    }
  /**
   * Opens the back channel of `itemId` to every rarity. A rarity is then worth `molesPerItem x its position in the rarity list`
   * (common x1, uncommon x2, rare x3, ...). Needs a `backChannel` buyable for the same item.
   */
  | { readonly kind: 'backChannelRarityScaling'; readonly itemId: ItemId }
  /** Multiplies the Moles every item of `itemId` is worth in the back channel by `factor` per copy. */
  | { readonly kind: 'backChannelMultiplier'; readonly itemId: ItemId; readonly factor: number }
  /**
   * Adds `amount` to the drop weight of the rarity `rarityId` of `itemId` per copy (of EVERY rarity when `rarityId` is left out), after
   * the Hacking Proficiency shifts. With weights that add up to 100, an `amount` of 0.1 is 0.1 percentage points, so even a rarity
   * that weighs 0 can drop.
   */
  | { readonly kind: 'rarityWeightBonus'; readonly itemId: ItemId; readonly amount: number; readonly rarityId?: string };
