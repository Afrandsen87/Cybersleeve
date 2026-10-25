/**
 * @module core
 *
 * Purchases ("buyables") paid with credits or network nodes: one-time or repeatable, optionally gated.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { traitsOf } from './effectTraits';
import { Snapshot } from './snapshot';
import type { BuyableDefinition, BuyableId, Currency, GameState } from './types';

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
   * @param pointsEarned the skill points earned in total from the state (what `skillPoints` purchases are paid from; default none)
   * @param snapshot scope in which the skill points are computed once (default: a private one that is never opened)
   */
  constructor(
    buyables: readonly BuyableDefinition[],
    private readonly factory: NumberFactory,
    private readonly costMultiplier: number,
    private readonly pointsEarned: (state: GameState) => number = () => 0,
    private readonly snapshot: Snapshot = new Snapshot(),
  ) {
    for (const b of buyables) this.byId.set(b.id, b);
  }

  /** Rounds up to a whole number. */
  private roundUp(n: BigNum): BigNum {
    const whole = n.floor();
    return whole.eq(n) ? n : whole.add(this.factory.fromNumber(1));
  }

  /** Copies of a buyable owned (0 if none or unknown). */
  owned(state: GameState, id: BuyableId): number {
    return state.purchased[id] ?? 0;
  }

  /** True when owning the buyable lets the player switch its effect on and off (see `EFFECT_TRAITS`). False for unknown ids. */
  isToggleable(id: BuyableId): boolean {
    const b = this.byId.get(id);
    return b !== undefined && traitsOf(b).toggleable;
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
   * Price of the NEXT copy, in the buyable's currency: `cost * costGrowth^owned * global.costMultiplier`. Prices in network
   * nodes are rounded up to a whole node.
   * @throws Error if the id is unknown
   */
  costOf(state: GameState, id: BuyableId): BigNum {
    const b = this.byId.get(id);
    if (!b) throw new Error(`Unknown buyable: ${id}`);
    const growth = this.factory.fromNumber(b.costGrowth ?? 1).pow(this.owned(state, id));
    const price = b.cost.mul(growth).mul(this.factory.fromNumber(this.costMultiplier));
    return b.currency === 'networkNodes' ? this.roundUp(price) : price;
  }

  /**
   * Skill points the player can still spend: those earned so far minus what the owned `skillPoints` purchases cost.
   * Nothing is stored for them: buying a skill raises the cost owned, which lowers this.
   *
   * @param state current state
   * @returns a whole number >= 0
   */
  skillPointsAvailable(state: GameState): number {
    return this.snapshot.memo('skillPoints', () => this.computeSkillPoints(state));
  }

  /** The work behind {@link Shop.skillPointsAvailable}. */
  private computeSkillPoints(state: GameState): number {
    let spent = 0;
    const lever = this.factory.fromNumber(this.costMultiplier);
    for (const b of this.byId.values()) {
      if (b.currency !== 'skillPoints') continue;
      const owned = this.owned(state, b.id);
      for (let copy = 0; copy < owned; copy++) {
        spent += b.cost
          .mul(this.factory.fromNumber(b.costGrowth ?? 1).pow(copy))
          .mul(lever)
          .toNumber();
      }
    }
    return Math.max(0, this.pointsEarned(state) - spent);
  }

  /** What the buyable is paid in (credits unless it says otherwise). @throws Error if the id is unknown */
  currencyOf(id: BuyableId): Currency {
    const b = this.byId.get(id);
    if (!b) throw new Error(`Unknown buyable: ${id}`);
    return b.currency ?? 'credits';
  }

  /** True when the buyable exists, is available, not maxed, and its currency covers the next price. */
  canBuy(state: GameState, id: BuyableId): boolean {
    return (
      this.byId.has(id) && this.isAvailable(state, id) && !this.isMaxed(state, id) && this.balance(state, id).gte(this.costOf(state, id))
    );
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
    if (this.balance(state, id).lt(price)) return 'cannot-afford';
    const currency = this.currencyOf(id);
    if (currency === 'networkNodes') state.network = state.network.sub(price);
    else if (currency === 'credits') state.credits = state.credits.sub(price);
    // skill points are not held: owning the copy is what spends them (see skillPointsAvailable)
    state.purchased[id] = this.owned(state, id) + 1;
    return 'purchased';
  }

  /** What the player holds of the buyable's currency. */
  private balance(state: GameState, id: BuyableId): BigNum {
    const currency = this.currencyOf(id);
    if (currency === 'skillPoints') return this.factory.fromNumber(this.skillPointsAvailable(state));
    return currency === 'networkNodes' ? state.network : state.credits;
  }
}
