/**
 * @module core
 *
 * The inventory: items held, and selling them for credits.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { GameConfig, GameState, ItemId, RarityId } from './types';

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
export function itemCount(state: Pick<GameState, 'inventory'>, itemId: ItemId, rarityId: RarityId): number {
  return state.inventory[itemId]?.[rarityId] ?? 0;
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
    const stacks = (this.state.inventory[itemId] ??= {});
    stacks[rarityId] = Math.min(MAX_STACK, (stacks[rarityId] ?? 0) + Math.floor(count));
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
    this.state.inventory[itemId]![rarityId] = held - taken;
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
    this.state.inventory[itemId]![rarityId] = held - sold;
    this.state.credits = this.state.credits.add(this.sellValue(rarityId).mul(this.factory.fromNumber(sold)));
    return sold;
  }
}
