/**
 * @module core
 *
 * How many copies of a buyable may be bought: its own `maxPurchases`, plus what owned `buyableCapBonus` skills add.
 */
import type { BuyableDefinition, BuyableId } from '../types';
import { effectsOfKind } from './ownedOfKind';

/** One owned-or-not skill that raises the cap of another buyable. */
interface CapSource {
  readonly sourceId: BuyableId;
  readonly targetId: BuyableId;
  readonly extra: number;
}

/**
 * Resolves the copy cap of every buyable. Built once from the content; it keeps no state and reads the owned counts it is handed.
 *
 * Called by: `shop.ts` (can it be bought), `progression.ts` (the floor of Faster conditioning), `serialization.ts` (clamping a save),
 * `testing/invariants.ts`. Calls: nothing.
 */
export class BuyableCaps {
  private readonly sources: readonly CapSource[];

  /** @param buyables all purchasable definitions (only the ones with a `buyableCapBonus` effect matter) */
  constructor(buyables: readonly BuyableDefinition[]) {
    this.sources = effectsOfKind(buyables, 'buyableCapBonus').map(({ buyable, effect }) => ({
      sourceId: buyable.id,
      targetId: effect.targetId,
      extra: effect.extra,
    }));
  }

  /**
   * Extra copies of `targetId` allowed by the skills owned in `purchased`.
   *
   * @param purchased copies owned, by buyable id
   * @param targetId the buyable whose cap is asked about
   * @returns a whole number >= 0
   */
  bonusOf(purchased: Readonly<Record<BuyableId, number>>, targetId: BuyableId): number {
    let extra = 0;
    for (const s of this.sources) if (s.targetId === targetId && (purchased[s.sourceId] ?? 0) > 0) extra += s.extra;
    return extra;
  }

  /**
   * The most copies of a buyable that may be owned: its `maxPurchases` (default 1) plus {@link BuyableCaps.bonusOf}.
   *
   * @param buyable the buyable
   * @param purchased copies owned, by buyable id
   * @returns a whole number >= 1, or `Infinity`
   */
  maxCopies(buyable: BuyableDefinition, purchased: Readonly<Record<BuyableId, number>>): number {
    return (buyable.maxPurchases ?? 1) + this.bonusOf(purchased, buyable.id);
  }
}
