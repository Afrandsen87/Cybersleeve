/**
 * @module core
 *
 * Reflex Archive: buys back, as soon as it is affordable, what the last life owned on the actions' cards.
 */
import { ownsKind } from '../effects/ownedOfKind';
import { isActionCardPurchase } from './resleeveCarry';
import type { Shop } from '../economy/shop';
import type { BuyableDefinition, GameState } from '../types';

/** Something that can be stepped once per slice of game time (what the engine calls). */
export interface Steppable {
  /** Does this slice's work. */
  step(): void;
}

/**
 * The Reflex Archive skill at work.
 *
 * @remarks
 * While a buyable with the `autoRepurchase` effect is owned, each slice buys the purchases of `GameState.lastLifePurchases` that are not
 * owned in full yet: only ones that are available (their `requires` are owned), not maxed and affordable, the cheapest base price first,
 * until nothing more can be bought. The prices are the normal ones, paid in credits. Buying more than last life had never happens.
 * Costs nothing when the skill is not owned or nothing is left to buy back.
 *
 * Called by: `engine.ts` (every slice). Calls: `Shop.canBuy`, `Shop.buy`.
 */
export class ReflexArchive implements Steppable {
  /** The purchases that can be bought back, cheapest base price first (content order breaks ties). */
  private readonly candidates: readonly BuyableDefinition[];

  /**
   * Creates the unit.
   *
   * @param buyables all purchasable definitions
   * @param state the live game state (mutated by buying; reads `lastLifePurchases` and `purchased`)
   * @param shop buys the purchases
   */
  constructor(
    private readonly buyables: readonly BuyableDefinition[],
    private readonly state: GameState,
    private readonly shop: Pick<Shop, 'canBuy' | 'buy'>,
  ) {
    this.candidates = buyables
      .filter(isActionCardPurchase)
      .map((b, order) => ({ b, order }))
      .sort((x, y) => (x.b.cost.lt(y.b.cost) ? -1 : y.b.cost.lt(x.b.cost) ? 1 : x.order - y.order))
      .map((x) => x.b);
  }

  /** True while the player owns a buyable with the `autoRepurchase` effect. */
  isActive(): boolean {
    return ownsKind(this.buyables, this.state.purchased, 'autoRepurchase');
  }

  /** Buys back everything that is affordable now. Called every slice. */
  step(): void {
    const wanted = this.state.lastLifePurchases;
    if (!this.isActive() || Object.keys(wanted).length === 0) return;
    let bought = true;
    while (bought) {
      bought = false;
      for (const b of this.candidates) {
        if ((this.state.purchased[b.id] ?? 0) >= (wanted[b.id] ?? 0) || !this.shop.canBuy(this.state, b.id)) continue;
        bought = this.shop.buy(this.state, b.id) === 'purchased';
        if (bought) break; // start again from the cheapest: a purchase may have opened another one
      }
    }
  }
}
