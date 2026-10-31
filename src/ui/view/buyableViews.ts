/**
 * @module ui
 *
 * The view of every buyable, and the groupings of buyables the screen needs (Sleeve sections).
 *
 * @remarks
 * Called by: `ui/viewModel.ts`, `sleeveView.ts`, `skillsView.ts`, `actionView.ts`, `squareView.ts`.
 * Calls: `GameQueries`, the text table.
 */
import {
  type BuyableDefinition,
  type GameConfig,
  isPointCurrency,
  hardeningBonusPerLevel,
  type LevelQueries,
  type ShopQueries,
  type StateQueries,
  resleeveGateId,
  traitsOf,
} from '../../core';
import { formatBigNum, formatPlain, num } from '../../numbers';
import type { BuyableValues, SleeveSectionId, UiText } from '../uiText';
import type { RevealTracker } from './revealTracker';
import { initials } from './viewFormat';
import type { BuyableView } from './viewTypes';

/** The effect kinds whose buyables are shown in the square of an action card instead of its row of purchases. */
const SQUARE_EFFECTS: readonly BuyableDefinition['effect']['kind'][] = ['autoRun', 'overclockUnlock', 'focusUnlock'];

/** Which Sleeve purchases go in which section, and in which order: derived from the content only, so computed once per config. */
const layoutCache = new WeakMap<GameConfig, readonly { id: SleeveSectionId; ids: readonly string[] }[]>();

/** Groups UI purchases by currency and caches each row's base-price order (ties keep configuration order).
 * Called by: sleeveView. Calls: sortByBasePrice, resleeveGateId, isPointCurrency, traitsOf.
 * @param config immutable content configuration
 * @returns cached nonempty currency rows, sleeve then network
 */
export function sectionLayout(config: GameConfig): readonly { id: SleeveSectionId; ids: readonly string[] }[] {
  const cached = layoutCache.get(config);
  if (cached) return cached;
  const sectionOf = (b: BuyableDefinition): SleeveSectionId => (b.currency === 'networkNodes' ? 'network' : 'sleeve');
  // Unlock resleeving is not listed: it is the Re-sleeve button until bought
  const gateId = resleeveGateId(config.buyables);
  const defs = config.buyables.filter(
    (b) => b.actionId === undefined && !isPointCurrency(b.currency) && !traitsOf(b).corporate && b.id !== gateId,
  );
  const layout = (['sleeve', 'network'] as const)
    .map((id) => ({
      id,
      ids: sortByBasePrice(defs.filter((b) => sectionOf(b) === id)).map((b) => b.id),
    }))
    .filter((section) => section.ids.length > 0);
  layoutCache.set(config, layout);
  return layout;
}

/** True for a buyable of the corporation (shown in the Asset Acquisition widget of the Corporation tab, not in the Sleeve widgets). */
export function isCorporate(config: GameConfig, id: string): boolean {
  const def = config.buyables.find((d) => d.id === id);
  return def !== undefined && traitsOf(def).corporate === true;
}

/** The corporation action whose card shows a buyable, or `undefined` when it is not tied to one. */
export function corporationActionOf(config: GameConfig, id: string): string | undefined {
  return config.buyables.find((d) => d.id === id)?.corporationActionId;
}

/** True for the currencies that are points: their buyables live in the Skills or Automation tab, not in the Sleeve widget (the rule is `isPointCurrency` in core). */
export { isPointCurrency };

/**
 * The live numbers behind the formula of a purchase, for the effects that have a formula to fill in.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.actionLevel`, `getState`, `hardeningBonusPerLevel` (the owner of the Forensic hardening rule), the text table.
 *
 * @param b the purchase
 * @param engine the engine to read the numbers from
 * @param owned copies owned (a purchase not yet owned shows what one copy gives)
 * @param text the display text
 * @param buyables every buyable (Hardened payload adds up the Forensic hardening that feeds it)
 * @returns the variables and the result, or `null` when the effect has no formula to fill in
 */
function purchaseValues(
  b: BuyableDefinition,
  engine: LevelQueries & ShopQueries & StateQueries,
  owned: number,
  text: UiText,
  buyables: readonly BuyableDefinition[],
): BuyableValues | null {
  if (b.effect.kind === 'iceRatingFromActionLevel') {
    const source = b.effect.sourceActionId;
    const base = b.effect.perLevel * Math.max(1, owned);
    let hardening: number | null = null;
    for (const h of buyables) {
      const copies = engine.ownedCount(h.id);
      if (h.effect.kind !== 'hardenedPayloadFromCrits' || h.effect.levelActionId !== source || copies <= 0) continue;
      const crits = engine.getState().sleeve.hardeningCrits[h.id] ?? 0;
      hardening = (hardening ?? 0) + hardeningBonusPerLevel(crits, h.effect.perCrit) * copies;
    }
    return text.tips.hardenedPayloadValues({
      base: formatPlain(base, 0),
      hardening: hardening === null ? null : formatPlain(hardening, 0),
      total: formatPlain(base + (hardening ?? 0), 0),
    });
  }
  if (b.effect.kind === 'hardenedPayloadFromCrits') {
    const crits = engine.getState().sleeve.hardeningCrits[b.id] ?? 0;
    return text.tips.hardeningValues({
      crits: formatPlain(crits, 0),
      perLevel: formatPlain(hardeningBonusPerLevel(crits, b.effect.perCrit) * Math.max(1, owned), 0),
    });
  }
  if (b.effect.kind !== 'networkGrowthFromActionLevel') return null;
  const level = engine.effectiveActionLevel(b.effect.sourceActionId);
  const copies = Math.max(1, owned);
  return text.tips.networkGrowthValues({ level: String(level), percent: formatPlain(level * b.effect.percentPerLevel * copies, 4) });
}

/**
 * Sorts buyable definitions by BASE price, cheapest first: `BuyableDefinition.cost` as configured, before cost growth, copies owned
 * or any price lever. Stable, so equal prices keep their configuration order. The one place that decides the order of purchases on
 * screen: change a price in the content and every widget re-sorts.
 *
 * Called by: {@link buildBuyableViews}, {@link sectionLayout}.
 *
 * @param defs the definitions (not modified)
 * @returns a new sorted array
 */
export function sortByBasePrice<T extends Pick<BuyableDefinition, 'cost'>>(defs: readonly T[]): T[] {
  return [...defs].sort((a, b) => (a.cost.lt(b.cost) ? -1 : a.cost.gt(b.cost) ? 1 : 0));
}

/** The buyables of a configuration in base-price order: derived from the content only, so computed once per config. */
const sortedCache = new WeakMap<GameConfig, readonly BuyableDefinition[]>();

/**
 * The view of every buyable in the configuration, in base-price order ({@link sortByBasePrice}). Every widget filters this list, so
 * each of them shows its purchases cheapest first.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.ownedCount`, `canBuy`, `costOf`, `isBuyableAvailable`, `RevealTracker.reveals`, the text table.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param text the display text
 * @param revealAll test aid: every purchase is `available`, whatever its requirements and reveal rules say
 * @param tracker the reveal ledger reader: a purchase it holds (`buyable:<id>`) stays shown, greyed and unbuyable (`gated`) while its requirements are unmet.
 *   Purchases paid in points are skills: the skill tree notes those (`skill:<id>`), not this list.
 */
export function buildBuyableViews(
  engine: LevelQueries & ShopQueries & StateQueries,
  config: GameConfig,
  text: UiText,
  revealAll = false,
  tracker?: RevealTracker,
): BuyableView[] {
  let sorted = sortedCache.get(config);
  if (!sorted) {
    sorted = sortByBasePrice(config.buyables);
    sortedCache.set(config, sorted);
  }
  return sorted.map((b): BuyableView => {
    const owned = engine.ownedCount(b.id);
    const toggleable = traitsOf(b).toggleable;
    const enabled = toggleable && engine.isAutoRunEnabled(b.id);
    const maxed = engine.isBuyableMaxed(b.id);
    const affordable = engine.canBuy(b.id);
    const cost = engine.costOf(b.id);
    const costText = formatBigNum(cost);
    const costUnit = (cost.eq(num(1)) ? text.costUnitsOne : text.costUnits)[engine.currencyOf(b.id)];
    const repeatable = (b.maxPurchases ?? 1) > 1;
    const requirementsMet = engine.isBuyableAvailable(b.id);
    const natural = requirementsMet && (SQUARE_EFFECTS.includes(b.effect.kind) || engine.isBuyableRevealed(b.id));
    const shown = tracker && !isPointCurrency(b.currency) ? tracker.reveals('buyable', b.id, natural) : natural;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      symbol: b.symbol ?? initials(b.name),
      actionId: isPointCurrency(b.currency) ? undefined : b.actionId, // a skill that names an action (for its effect) is not on that action's card
      costText,
      costUnit,
      owned,
      ownedText: formatBigNum(num(owned)),
      repeatable,
      maxed,
      available: revealAll || shown,
      gated: shown && !requirementsMet,
      affordable,
      toggleable,
      enabled,
      clickable: (toggleable && owned > 0) || (!maxed && affordable),
      inSquare: SQUARE_EFFECTS.includes(b.effect.kind),
      get tip() {
        return text.tips.buyable({
          name: b.name,
          description: b.description,
          formula: b.formula ?? null,
          values: purchaseValues(b, engine, owned, text, config.buyables),
          cost: costText,
          costUnit,
          owned,
          repeatable,
          maxed,
          toggleable,
          enabled,
        });
      },
    };
  });
}
