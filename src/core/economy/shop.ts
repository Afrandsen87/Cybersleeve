/**
 * @module core
 *
 * Purchases ("buyables") paid with credits, network nodes or points: one-time or repeatable, optionally gated.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { BuyableCaps } from '../effects/buyableCaps';
import { traitsOf } from '../effects/effectTraits';
import { currencyInfo, heldBalance, isPointCurrency, spendHeld } from '../kernel/currencies';
import { Snapshot } from '../kernel/snapshot';
import type { BuyableDefinition, BuyableId, Currency, GameState, PointCurrency } from '../types';

/** Called after a copy of a buyable has been bought (for rules that react to a purchase, like the free synthetic sleeve). */
export type PurchaseListener = (buyable: BuyableDefinition) => void;

/** Why a purchase did or did not happen. */
export type PurchaseResult = 'purchased' | 'max-reached' | 'locked' | 'cannot-afford' | 'unknown';

/**
 * Handles buying. Stateless: mutates the `GameState` passed in.
 *
 * Called by: `engine.ts`, `ui/viewModel.ts` (availability and price queries).
 */
export class Shop {
  private readonly byId = new Map<BuyableId, BuyableDefinition>();
  private readonly caps: BuyableCaps;

  /**
   * Creates the shop.
   *
   * @param buyables all purchasable definitions
   * @param factory number factory
   * @param costMultiplier global price lever (`global.costMultiplier`)
   * @param pointsEarned the points of a currency earned in total from the state (what purchases paid in `skillPoints`, `resleevePoints` or `automationPoints` are paid from; default none)
   * @param snapshot scope in which the points are computed once (default: a private one that is never opened)
   * @param revealOrders `reveal.buyableOrders`: how many orders of magnitude above the peak balance a price may be and still show (default: all show)
   * @param onPurchased called after every purchase (default: nothing)
   */
  constructor(
    buyables: readonly BuyableDefinition[],
    private readonly factory: NumberFactory,
    private readonly costMultiplier: number,
    private readonly pointsEarned: (currency: PointCurrency, state: GameState) => number = () => 0,
    private readonly snapshot: Snapshot = new Snapshot(),
    private readonly revealOrders: number = Infinity,
    private readonly onPurchased: PurchaseListener = () => {},
  ) {
    for (const b of buyables) this.byId.set(b.id, b);
    this.caps = new BuyableCaps(buyables);
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

  /**
   * Switches an owned toggleable buyable (an auto-run) on or off.
   *
   * @param state state to mutate (`autoRunOff`)
   * @param id the buyable
   * @returns true when it is now on; false when it is now off, or when it is not owned or not toggleable (nothing changes then)
   */
  toggle(state: GameState, id: BuyableId): boolean {
    if (this.owned(state, id) <= 0 || !this.isToggleable(id)) return false;
    if (state.autoRunOff[id]) delete state.autoRunOff[id];
    else state.autoRunOff[id] = true;
    return !state.autoRunOff[id];
  }

  /**
   * True when every buyable listed in `requires` and in `parents` is owned and `revealAfterResleeves` re-sleeves have happened
   * (always true without either).
   */
  isAvailable(state: GameState, id: BuyableId): boolean {
    const b = this.byId.get(id);
    if (!b) return false;
    if (state.runs.length < (b.revealAfterResleeves ?? 0)) return false;
    return [...(b.requires ?? []), ...(b.parents ?? [])].every((r) => this.owned(state, r) > 0);
  }

  /**
   * True when the purchase should be shown: it is available and either already owned, paid in skill points, or its next price is within
   * `revealOrders` orders of magnitude of the most of its currency ever held this life (`peakCredits` / `peakNetwork`, counted as at least 1).
   * Called by: `ui/viewModel.ts` through the engine.
   */
  isRevealed(state: GameState, id: BuyableId): boolean {
    if (!this.isAvailable(state, id)) return false;
    if (this.owned(state, id) > 0 || this.revealOrders === Infinity) return true;
    const { alwaysRevealed, peak: peakField } = currencyInfo(this.currencyOf(id));
    if (alwaysRevealed || !peakField) return true;
    const peak = state[peakField];
    // a peak below one counts as one, so a new game with nothing yet still shows the cheapest purchases
    const reference = peak.lt(this.factory.fromNumber(1)) ? this.factory.fromNumber(1) : peak;
    return this.costOf(state, id).lte(reference.mul(this.factory.fromNumber(10).pow(this.revealOrders)));
  }

  /** True when no further copy can be bought (`maxPurchases` plus any `buyableCapBonus` reached). */
  isMaxed(state: GameState, id: BuyableId): boolean {
    const b = this.byId.get(id);
    return !b || this.owned(state, id) >= this.caps.maxCopies(b, state.purchased);
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
    return currencyInfo(b.currency).wholeUnits ? this.roundUp(price) : price;
  }

  /**
   * Points of a currency the player can still spend: those earned so far minus what the owned purchases paid in that currency cost.
   * Nothing is stored for them: buying a skill raises the cost owned, which lowers this.
   *
   * @param state current state
   * @param currency `skillPoints`, `resleevePoints` or `automationPoints`
   * @returns a whole number >= 0
   */
  pointsAvailable(state: GameState, currency: PointCurrency): number {
    return this.snapshot.memo(currency, () => this.computePoints(state, currency));
  }

  /** Skill points earned in total from the action levels, spent or not. Called by: `engine.ts`. */
  skillPointsEarned(state: GameState): number {
    return this.pointsEarned('skillPoints', state);
  }

  /** The work behind {@link Shop.pointsAvailable}. */
  private computePoints(state: GameState, currency: PointCurrency): number {
    let spent = 0;
    const lever = this.factory.fromNumber(this.costMultiplier);
    for (const b of this.byId.values()) {
      if (b.currency !== currency) continue;
      const owned = this.owned(state, b.id);
      for (let copy = 0; copy < owned; copy++) {
        spent += b.cost
          .mul(this.factory.fromNumber(b.costGrowth ?? 1).pow(copy))
          .mul(lever)
          .toNumber();
      }
    }
    return Math.max(0, this.pointsEarned(currency, state) - spent);
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
    // points are not held: owning the copy is what spends them (see pointsAvailable)
    spendHeld(state, this.currencyOf(id), price);
    state.purchased[id] = this.owned(state, id) + 1;
    this.onPurchased(this.byId.get(id)!);
    return 'purchased';
  }

  /** What the player holds of the buyable's currency. */
  private balance(state: GameState, id: BuyableId): BigNum {
    const currency = this.currencyOf(id);
    return isPointCurrency(currency) ? this.factory.fromNumber(this.pointsAvailable(state, currency)) : heldBalance(state, currency);
  }
}
