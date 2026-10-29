/**
 * @module core
 *
 * What the retention skills carry over a re-sleeve, on top of the positive lists in `state.ts`: a record of last life's purchases (always),
 * and whatever the `carry` hook of an owned effect carries (the registry entries in `resleeveEffects.ts`).
 */
import { definitionOf } from '../effects/effectRegistry';
import { traitsOf } from '../effects/effectTraits';
import { currencyInfo } from '../kernel/currencies';
import type { NumberFactory } from '../../numbers';
import type { BuyableDefinition, GameState, StateSlice } from '../types';

/**
 * The purchases that sit on an action's card and are paid in credits: what Reflex Archive buys back. Corporation purchases are not among
 * them (the corporation survives re-sleeving anyway), nor are purchases paid in nodes or points.
 *
 * Called by: {@link recordLastLife}, `reflexArchive.ts`.
 */
export function isActionCardPurchase(b: BuyableDefinition): boolean {
  return b.actionId !== undefined && b.corporationActionId === undefined && currencyInfo(b.currency).archivedByReflex === true;
}

/**
 * Writes down what the life that ends owned on the actions' cards, for the next life's Reflex Archive. Done at every re-sleeve.
 *
 * Called by: `state.ts` (`resetForResleeve`). Calls: {@link isActionCardPurchase}.
 *
 * @param old the state of the life that ends
 * @param fresh the state of the new life (mutated: `lastLifePurchases`)
 * @param buyables all purchasable definitions
 */
export function recordLastLife(
  old: StateSlice<'purchased'>,
  fresh: StateSlice<'lastLifePurchases'>,
  buyables: readonly BuyableDefinition[],
): void {
  for (const b of buyables) {
    const owned = old.sleeve.purchased[b.id] ?? 0;
    if (owned > 0 && isActionCardPurchase(b)) fresh.wallet.lastLifePurchases[b.id] = owned;
  }
}

/**
 * Applies the retention skills of the old life to the fresh state of the new one: each owned buyable whose effect has a `carry` hook in the
 * effect registry (Daemon Persistence, Residual Proficiency, Residual Firewall; see `resleeveEffects.ts`) carries its part.
 *
 * Called by: `state.ts` (`resetForResleeve`). Calls: `definitionOf(...).carry`.
 *
 * @param old the state of the life that ends (read only)
 * @param fresh the state of the new life (mutated)
 * @param buyables all purchasable definitions
 * @param factory number factory
 */
export function carryRetention(old: GameState, fresh: GameState, buyables: readonly BuyableDefinition[], factory: NumberFactory): void {
  for (const b of buyables) {
    const owned = old.sleeve.purchased[b.id] ?? 0;
    if (owned > 0) definitionOf(b).carry?.(b.effect, { owned, old, fresh, buyables, factory, traitsOf });
  }
}
