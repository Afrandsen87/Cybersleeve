/**
 * @module core
 *
 * Purchases ("buyables") paid with credits: one-time or repeatable, optionally gated.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { BuyableDefinition, BuyableId, GameState } from './types';

/** Why a purchase did or did not happen. */
export type PurchaseResult = 'purchased' | 'max-reached' | 'locked' | 'cannot-afford' | 'unknown';

/**
 * Handles buying. Stateless: mutates the `GameState` passed in.
 *
 * Called by: `engine.ts`, `ui/viewModel.ts` (availability and price queries).
 */
export class Shop {
  private readonly byId = new Map<BuyableId, BuyableDefinition>();

  /**
   * Creates the shop.
   *
   * @param buyables all purchasable definitions
   * @param factory number factory
   * @param costMultiplier global price lever (`global.costMultiplier`)
   */
  constructor(
    buyables: readonly BuyableDefinition[],
    private readonly factory: NumberFactory,
    private readonly costMultiplier: number,
  ) {
    for (const b of buyables) this.byId.set(b.id, b);
  }

  /** Copies of a buyable owned (0 if none or unknown). */
  owned(state: GameState, id: BuyableId): number {
    return state.purchased[id] ?? 0;
  }

  /** True when every buyable listed in `requires` is owned (always true without requirements). */
  isAvailable(state: GameState, id: BuyableId): boolean {
    const b = this.byId.get(id);
    if (!b) return false;
    return (b.requires ?? []).every((r) => this.owned(state, r) > 0);
  }

  /** True when no further copy can be bought (`maxPurchases` reached). */
  isMaxed(state: GameState, id: BuyableId): boolean {
    const b = this.byId.get(id);
    return !b || this.owned(state, id) >= (b.maxPurchases ?? 1);
  }

  /**
   * Price of the NEXT copy: `cost * costGrowth^owned * global.costMultiplier`.
   * @throws Error if the id is unknown
   */
  costOf(state: GameState, id: BuyableId): BigNum {
    const b = this.byId.get(id);
    if (!b) throw new Error(`Unknown buyable: ${id}`);
    const growth = this.factory.fromNumber(b.costGrowth ?? 1).pow(this.owned(state, id));
    return b.cost.mul(growth).mul(this.factory.fromNumber(this.costMultiplier));
  }

  /** True when the buyable exists, is available, not maxed, and credits cover the next price. */
  canBuy(state: GameState, id: BuyableId): boolean {
    return this.byId.has(id) && this.isAvailable(state, id) && !this.isMaxed(state, id) && state.credits.gte(this.costOf(state, id));
  }

  /**
   * Buys one copy if possible, deducting its price.
   * @returns what happened; state changes only for `'purchased'`
   */
  buy(state: GameState, id: BuyableId): PurchaseResult {
    if (!this.byId.has(id)) return 'unknown';
    if (!this.isAvailable(state, id)) return 'locked';
    if (this.isMaxed(state, id)) return 'max-reached';
    const price = this.costOf(state, id);
    if (state.credits.lt(price)) return 'cannot-afford';
    state.credits = state.credits.sub(price);
    state.purchased[id] = this.owned(state, id) + 1;
    return 'purchased';
  }
}
