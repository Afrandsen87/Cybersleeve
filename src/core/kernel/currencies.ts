/**
 * @module core
 *
 * The currencies buyables are paid in, as data: one descriptor each. Every rule about a currency (where its balance lives, whether prices
 * are whole units, whether purchases survive a re-sleeve, how its reveal is judged) is read from here, never from a currency name.
 */
import type { BigNum } from '../../numbers';
import type { StateSlice } from '../types';
import { bigScalar, setBigScalar } from './fields';

/** The state scalars a held currency is kept in. */
type HeldField = 'credits' | 'network';

/** Everything the game needs to know about one currency. One entry per currency in {@link CURRENCIES}. */
export interface CurrencyDescriptor {
  /**
   * The state scalar the balance is held in. Absent for a points currency: points are not held, what can be spent is what has been
   * earned minus the cost of the buyables owned.
   */
  readonly held?: HeldField;
  /** Prices come in whole units: the price of a copy is rounded up, and a share-of-balance cost is rounded down to whole units. */
  readonly wholeUnits?: boolean;
  /** The state scalar holding the most of the currency ever held this life (what a price is compared to when judging a reveal). */
  readonly peak?: 'peakCredits' | 'peakNetwork';
  /** Purchases show from the start, whatever their price (no reveal by price). */
  readonly alwaysRevealed?: boolean;
  /** Destroying it as a start cost pays the Credit Siphon (the units destroyed are what the siphon pays for). */
  readonly siphoned?: boolean;
  /** Buyables paid in it survive a re-sleeve. */
  readonly carriedOverResleeve?: boolean;
  /** Purchases on an action's card paid in it are what Reflex Archive buys back. */
  readonly archivedByReflex?: boolean;
  /** Buyables paid in it are the sleeve skills (the sleeve skill tree, refunded by the v10 save migration, counted by `requiresSleeveSkills`). */
  readonly sleeveSkills?: boolean;
}

/** What a buyable is paid with. */
export type Currency = 'credits' | 'networkNodes' | 'skillPoints' | 'resleevePoints' | 'automationPoints';

/** The currencies that are points, not held amounts (the ones without a `held` field in {@link CURRENCIES}; a test keeps the two in step). */
export type PointCurrency = 'skillPoints' | 'resleevePoints' | 'automationPoints';

/**
 * The descriptor of every currency. A new currency is one `Currency` member and one entry here; the compiler demands it.
 * Skill points come from action levels; sleeve skill points from re-sleeving; automation points from the `automationPoints` buyables.
 */
export const CURRENCIES: Readonly<Record<Currency, CurrencyDescriptor>> = {
  credits: { held: 'credits', peak: 'peakCredits', archivedByReflex: true },
  networkNodes: { held: 'network', peak: 'peakNetwork', wholeUnits: true, siphoned: true },
  skillPoints: { alwaysRevealed: true },
  // judged against the credits peak, like the other re-sleeve purchases
  resleevePoints: { peak: 'peakCredits', carriedOverResleeve: true, sleeveSkills: true },
  automationPoints: { alwaysRevealed: true },
};

/** Every valid currency id. */
export const CURRENCY_IDS = Object.keys(CURRENCIES) as readonly Currency[];

/** The currency a buyable is paid in when it names none. */
export const DEFAULT_CURRENCY: Currency = 'credits';

/** The descriptor of a currency (`undefined` means the default currency). */
export function currencyInfo(currency: Currency | undefined): CurrencyDescriptor {
  return CURRENCIES[currency ?? DEFAULT_CURRENCY];
}

/**
 * True when a buyable is a sleeve skill: it is paid in the currency whose descriptor says `sleeveSkills`. The ONE definition of the term;
 * code and tests ask this, never the currency name.
 *
 * Called by: {@link sleeveSkillIds}, `ui/view/panelViews.ts`, content and save tests. Calls: {@link currencyInfo}.
 *
 * @param buyable anything with an optional currency
 */
export function isSleeveSkill(buyable: { readonly currency?: Currency }): boolean {
  // an unknown currency (config validation runs on bad content too) is not a sleeve skill
  return (CURRENCIES[buyable.currency ?? DEFAULT_CURRENCY] as CurrencyDescriptor | undefined)?.sleeveSkills === true;
}

/**
 * The ids of the sleeve skills among some buyables, in their order.
 *
 * Called by: `economy/shop.ts` (`requiresSleeveSkills`), `config/skillGates.ts`, `app/persistence.ts` (the v10 refund), tests. Calls: {@link isSleeveSkill}.
 *
 * @param buyables the configured buyables
 */
export function sleeveSkillIds(buyables: readonly { readonly id: string; readonly currency?: Currency }[]): string[] {
  return buyables.filter(isSleeveSkill).map((b) => b.id);
}

/**
 * True when the currency is a points currency (not held).
 *
 * Called by: `shop.ts`, `config.ts`, `ui/view/buyableViews.ts`.
 */
export function isPointCurrency(currency: Currency | undefined): currency is PointCurrency {
  return currencyInfo(currency).held === undefined;
}

/**
 * The held balance of a currency.
 *
 * Called by: `shop.ts`, `startCosts.ts`.
 *
 * @param state current state
 * @param currency a held currency (`undefined` means the default one)
 * @throws Error for a points currency, which has no held balance
 */
export function heldBalance(state: StateSlice<HeldField>, currency: Currency | undefined): BigNum {
  const field = currencyInfo(currency).held;
  if (field === undefined) throw new Error(`${currency} is a points currency: it has no held balance`);
  return bigScalar(state, field);
}

/**
 * Takes `amount` out of the held balance of a currency. Points currencies are not held, so nothing is taken from them: owning the
 * purchase is what spends them.
 *
 * Called by: `shop.ts`, `startCosts.ts`.
 */
export function spendHeld(state: StateSlice<HeldField>, currency: Currency | undefined, amount: BigNum): void {
  const field = currencyInfo(currency).held;
  if (field !== undefined) setBigScalar(state, field, bigScalar(state, field).sub(amount));
}

/** The currencies whose buyables survive a re-sleeve. */
export const CARRIED_OVER_CURRENCIES: readonly Currency[] = CURRENCY_IDS.filter((c) => CURRENCIES[c].carriedOverResleeve === true);
