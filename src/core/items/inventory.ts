/**
 * @module core
 *
 * The inventory: items held, and selling them for credits.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import type { GameConfig, GameState, ItemId, RarityId, StateSlice } from '../types';

/** Most of one stack that can be held; counts are plain numbers and stay whole and exact below this. */
const MAX_STACK = Number.MAX_SAFE_INTEGER;

/**
 * How many items of one stack are held.
 *
 * Called by: {@link Inventory}, `ui/viewModel.ts`.
 *
 * @param state state to read
 * @param itemId the item
 * @param rarityId the rarity
 * @returns the count (0 when none)
 */
export function itemCount(state: StateSlice<'inventory'>, itemId: ItemId, rarityId: RarityId): number {
  return state.wallet.inventory[itemId]?.[rarityId] ?? 0;
}

/**
 * The inventory rules: adding drops and selling stacks.
 *
 * @remarks
 * Selling pays the rarity's `sellValue` per item in credits. It is a trade, not an earning: the heat tax and
 * `global.creditMultiplier` (which scale run rewards and passive income) do not touch it.
 * Called by: `drops.ts` (`ItemDrops`), `engine.ts` (`GameEngine.sellItems`).
 */
export class Inventory {
  private readonly values = new Map<RarityId, BigNum>();
  private readonly items = new Set<ItemId>();
  private readonly unsellable = new Set<ItemId>();
  /** The first (most common) rarity: where an item without rarity keeps its single stack. */
  private readonly first: RarityId | undefined;

  /**
   * Creates the unit.
   *
   * @param config reads `items` (the known items and the sell value of each rarity)
   * @param state the live game state (mutated: `inventory`, `credits`)
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'items'>,
    private readonly state: GameState,
    private readonly factory: NumberFactory,
  ) {
    this.first = config.items.rarities[0]?.id;
    for (const r of config.items.rarities) this.values.set(r.id, r.sellValue);
    for (const i of config.items.definitions) {
      this.items.add(i.id);
      if (i.sellable === false) this.unsellable.add(i.id);
    }
  }

  /** Credits one item of this rarity sells for (0 for an unknown rarity). */
  sellValue(rarityId: RarityId): BigNum {
    return this.values.get(rarityId) ?? this.factory.fromNumber(0);
  }

  /**
   * Puts items in the inventory. Unknown items and rarities are ignored; a stack stops growing at the largest exact count.
   *
   * @param itemId the item
   * @param rarityId the rarity
   * @param count how many (a whole number >= 0)
   */
  add(itemId: ItemId, rarityId: RarityId, count: number): void {
    if (!this.items.has(itemId) || !this.values.has(rarityId) || !(count > 0)) return;
    const stacks = (this.state.wallet.inventory[itemId] ??= {});
    stacks[rarityId] = Math.min(MAX_STACK, (stacks[rarityId] ?? 0) + Math.floor(count));
  }

  /**
   * How many items are held in the item's single stack, which is kept under the first (most common) rarity.
   *
   * Called by: `crits/zeroDays.ts`, `items/skillShards.ts`. Calls: {@link itemCount}.
   *
   * @param itemId the item
   * @returns the count (0 when none, or when the game has no rarities)
   */
  heldFirst(itemId: ItemId): number {
    return this.first === undefined ? 0 : itemCount(this.state, itemId, this.first);
  }

  /**
   * Takes items out of the item's single stack (under the first rarity).
   *
   * Called by: `crits/zeroDays.ts`, `items/skillShards.ts`. Calls: {@link Inventory.take}.
   *
   * @param itemId the item
   * @param amount how many to take, or `'all'`
   * @returns how many were taken (0 when empty, unknown, or the game has no rarities)
   */
  takeFirst(itemId: ItemId, amount: number | 'all'): number {
    return this.first === undefined ? 0 : this.take(itemId, this.first, amount);
  }

  /**
   * Adds items to the item's single stack (under the first rarity).
   *
   * Called by: `items/drops.ts`, `crits/zeroDays.ts`. Calls: {@link Inventory.add}.
   *
   * @param itemId the item
   * @param count how many (a whole number >= 0)
   */
  addFirst(itemId: ItemId, count: number): void {
    if (this.first !== undefined) this.add(itemId, this.first, count);
  }

  /**
   * Takes items out of a stack without paying anything (the caller decides what they are given up for).
   *
   * @param itemId the item
   * @param rarityId the rarity
   * @param amount how many to take, or `'all'`; more than held takes what is held
   * @returns how many were taken (0 when the stack is empty or unknown)
   */
  take(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number {
    const held = itemCount(this.state, itemId, rarityId);
    const wanted = amount === 'all' ? held : Math.floor(amount);
    const taken = Math.min(held, Number.isFinite(wanted) ? wanted : 0);
    if (!(taken > 0)) return 0;
    this.state.wallet.inventory[itemId]![rarityId] = held - taken;
    return taken;
  }

  /**
   * Sells items of one stack for credits. Items of a kind that is not `sellable` cannot be sold.
   *
   * @param itemId the item
   * @param rarityId the rarity
   * @param amount how many to sell, or `'all'`; more than held sells what is held
   * @returns how many were sold (0 when the stack is empty or unknown)
   */
  sell(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number {
    if (this.unsellable.has(itemId)) return 0;
    const held = itemCount(this.state, itemId, rarityId);
    const wanted = amount === 'all' ? held : Math.floor(amount);
    const sold = Math.min(held, Number.isFinite(wanted) ? wanted : 0);
    if (!(sold > 0)) return 0;
    this.state.wallet.inventory[itemId]![rarityId] = held - sold;
    this.state.wallet.credits = this.state.wallet.credits.add(this.sellValue(rarityId).mul(this.factory.fromNumber(sold)));
    return sold;
  }
}
