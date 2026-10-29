/**
 * @module core
 *
 * What the retention skills carry over a re-sleeve, on top of the positive lists in `state.ts`: a record of last life's purchases (always),
 * the Automation tab (Daemon Persistence), and shares of Hacking Proficiency and ICE Rating (Residual Proficiency and Residual Firewall).
 */
import { ownsKind } from '../effects/ownedOfKind';
import { currencyInfo } from '../kernel/currencies';
import { logScaled } from '../kernel/curves';
import type { BigNum, NumberFactory } from '../../numbers';
import type { BuyableDefinition, GameState, StateSlice } from '../types';

/** True while the player owns a buyable with the given effect kind. */
function owns(
  buyables: readonly BuyableDefinition[],
  purchased: Readonly<Record<string, number>>,
  kind: BuyableDefinition['effect']['kind'],
): boolean {
  return ownsKind(buyables, purchased, kind);
}

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

/** True when a purchase belongs to the Automation tab: an automation skill, or a purchase that gives automation points (the Automation core). */
function isAutomationPurchase(b: BuyableDefinition): boolean {
  return b.currency === 'automationPoints' || b.effect.kind === 'automationPoints';
}

/**
 * Applies the retention skills of the old life to the fresh state of the new one.
 *
 * @remarks
 * - Daemon Persistence (`keepsAutomation`): the automation state and the automation purchases are kept, so points earned minus points
 *   spent stays what it was.
 * - Residual Proficiency (`carriesProficiency`): Hacking Proficiency starts at `scale x log10(1 + old)`.
 * - Residual Firewall (`carriesIceRating`): ICE Rating starts at `old ^ share`, never below the starting value.
 *
 * Called by: `state.ts` (`resetForResleeve`). Calls: nothing.
 *
 * @param old the state of the life that ends (read only)
 * @param fresh the state of the new life (mutated)
 * @param buyables all purchasable definitions
 * @param factory number factory
 */
export function carryRetention(old: GameState, fresh: GameState, buyables: readonly BuyableDefinition[], factory: NumberFactory): void {
  if (owns(buyables, old.sleeve.purchased, 'keepsAutomation')) {
    fresh.wallet.automation = old.wallet.automation;
    for (const b of buyables) {
      const owned = old.sleeve.purchased[b.id] ?? 0;
      if (owned > 0 && isAutomationPurchase(b)) fresh.sleeve.purchased[b.id] = owned;
    }
  }
  for (const b of buyables) {
    if ((old.sleeve.purchased[b.id] ?? 0) <= 0) continue;
    if (b.effect.kind === 'carriesProficiency') {
      const kept = logScaled(b.effect.scale, old.sleeve.hackingProficiency.toNumber());
      if (Number.isFinite(kept) && kept > 0) fresh.sleeve.hackingProficiency = factory.fromNumber(kept);
    }
    if (b.effect.kind === 'carriesIceRating') {
      const kept: BigNum = old.sleeve.iceRating.pow(b.effect.share);
      if (kept.gt(fresh.sleeve.iceRating)) fresh.sleeve.iceRating = kept;
    }
  }
}
