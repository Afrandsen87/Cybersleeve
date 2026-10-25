/**
 * @module core
 *
 * The back channel: giving up items for Moles.
 */
import type { Inventory } from './inventory';
import type { BackChannelRule } from './effects';
import type { GameState, ItemId, RarityId } from './types';

/**
 * Turns items into Moles through the channel a skill unlocked.
 *
 * @remarks
 * Each item taken adds the rule's `molesPerItem` Moles to the state; Moles make heat cool faster (see `coolHeatBoosted`). Without a
 * channel, or for any other item or rarity than the one it names, nothing happens.
 *
 * Called by: `engine.ts` (`GameEngine.giveUpForMoles`). Calls: `Inventory.take`.
 */
export class BackChannel {
  /**
   * Creates the unit.
   *
   * @param state the live game state (mutated: `moles`)
   * @param rule the channel the player has unlocked now, or `null` (satisfied by `DerivedStats`)
   * @param inventory where the items are taken from
   */
  constructor(
    private readonly state: GameState,
    private readonly rule: { backChannel(): BackChannelRule | null },
    private readonly inventory: Inventory,
  ) {}

  /**
   * Gives up items for Moles.
   *
   * @param itemId the item
   * @param rarityId the rarity
   * @param amount how many, or `'all'`; more than held gives up what is held
   * @returns how many were given up
   */
  giveUp(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number {
    const channel = this.rule.backChannel();
    if (!channel || channel.itemId !== itemId || channel.rarityId !== rarityId) return 0;
    const taken = this.inventory.take(itemId, rarityId, amount);
    this.state.moles += taken * channel.molesPerItem;
    return taken;
  }
}
