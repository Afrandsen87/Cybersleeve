/**
 * @module core
 *
 * Start costs of actions: what starting one costs, whether it can be paid, and paying it (with the Credit Siphon).
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { currencyInfo, heldBalance, spendHeld } from '../kernel/currencies';
import type { DerivedStats } from '../engine/stats';
import type { ActionDefinition, ActionId, GameState } from '../types';
import type { ActionLookup } from './actionLookup';

/**
 * Prices and pays the start cost of actions.
 *
 * Called by: `actionRunner.ts`. Calls: {@link DerivedStats} (`startCostScale`, `siphonSeconds`, `taxedCreditsPerNode`).
 */
export class StartCosts {
  /**
   * Creates the unit.
   *
   * @param state the live game state (mutated by {@link StartCosts.pay})
   * @param stats derived values
   * @param factory number factory
   * @param definition action lookup
   */
  constructor(
    private readonly state: GameState,
    private readonly stats: DerivedStats,
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
  ) {}

  /**
   * What starting the action would cost right now: the fixed amount plus the share of the balance held (network nodes are
   * rounded down to whole nodes). The share is scaled by `DerivedStats.startCostScale`: lowered by Decommission protocol, raised by the
   * links of an Overclock chain, never above the whole balance. With a reduction owned, a node cost that rounds down to 0 is 1 node.
   * @returns the cost, or `null` when starting is free
   * @throws Error if the action id is unknown
   */
  costOf(id: ActionId): BigNum | null {
    const cost = this.definition(id).startCost;
    if (!cost) return null;
    const whole = currencyInfo(cost.currency).wholeUnits === true;
    const balance = heldBalance(this.state, cost.currency);
    let total = cost.amount ?? this.factory.fromNumber(0);
    if (cost.fractionOfBalance !== undefined) {
      const scale = this.stats.startCostScale(id);
      const share = balance.mul(this.factory.fromNumber(Math.min(1, cost.fractionOfBalance * scale.factor)));
      let part = whole ? share.floor() : share;
      // A reduction never lets the price vanish: one node is the least a network can be made to give up.
      if (scale.atLeastOne && whole && part.isZero() && balance.gte(this.factory.fromNumber(1))) {
        part = this.factory.fromNumber(1);
      }
      total = total.add(part);
    }
    return total;
  }

  /** True when the start cost (if any) can be paid now; a share-of-balance cost that comes to 0 cannot (the run would be free). */
  canPay(def: ActionDefinition): boolean {
    const cost = def.startCost;
    const price = this.costOf(def.id);
    if (!cost || !price) return true;
    const balance = heldBalance(this.state, cost.currency);
    return !(balance.lt(price) || (cost.fractionOfBalance !== undefined && price.isZero()));
  }

  /**
   * Pays an action's start cost, if it has one. A share-of-balance cost that comes to 0 cannot be paid (the run would be free).
   * @returns false (and pays nothing) when the player cannot afford it
   */
  pay(def: ActionDefinition): boolean {
    const cost = def.startCost;
    const price = this.costOf(def.id);
    if (!cost || !price) return true;
    if (!this.canPay(def)) return false;
    spendHeld(this.state, cost.currency, price);
    if (currencyInfo(cost.currency).siphoned) this.paySiphon(def.id, price);
    return true;
  }

  /**
   * Pays the Credit Siphon of an action for the nodes its start cost just destroyed: `siphonSeconds` seconds of what one node
   * produces now (after the node payout multiplier and the heat tax) for each node. Nothing without a Credit Siphon.
   */
  private paySiphon(id: ActionId, destroyed: BigNum): void {
    const seconds = this.stats.siphonSeconds(id);
    if (!(seconds > 0)) return;
    const perNode = this.stats.taxedCreditsPerNode();
    this.state.wallet.credits = this.state.wallet.credits.add(destroyed.mul(perNode).mul(this.factory.fromNumber(seconds)));
  }
}
