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
  type Currency,
  type GameConfig,
  type LevelQueries,
  type ShopQueries,
  sleeveLevelsGateId,
  traitsOf,
} from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { BuyableValues, SleeveSectionId, UiText } from '../uiText';
import { initials } from './viewFormat';
import type { BuyableView } from './viewTypes';

/** The effect kinds whose buyables are shown in the square of an action card instead of its row of purchases. */
const SQUARE_EFFECTS: readonly BuyableDefinition['effect']['kind'][] = ['autoRun', 'overclockUnlock', 'focusUnlock'];

/** Which Sleeve purchases go in which section, and in which order: derived from the content only, so computed once per config. */
const layoutCache = new WeakMap<GameConfig, readonly { id: SleeveSectionId; ids: readonly string[] }[]>();

/** Groups the Sleeve purchases into sections and sorts each by base price (ties keep the configuration order). */
export function sectionLayout(config: GameConfig): readonly { id: SleeveSectionId; ids: readonly string[] }[] {
  const cached = layoutCache.get(config);
  if (cached) return cached;
  const sectionOf = (b: BuyableDefinition): SleeveSectionId =>
    b.currency === 'networkNodes' ? 'nodes' : (b.maxPurchases ?? 1) > 1 ? 'rebuyable' : 'oneTime';
  // the sleeve-levels unlock is not listed: it is the Re-sleeve button until bought
  const gateId = sleeveLevelsGateId(config.buyables);
  const defs = config.buyables.filter(
    (b) => b.actionId === undefined && !isPointCurrency(b.currency) && !traitsOf(b).corporate && b.id !== gateId,
  );
  const layout = (['rebuyable', 'oneTime', 'nodes'] as const)
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

/** True for the currencies that are points (skill points, re-sleeve points, automation points): their buyables live in the Skills or Automation tab, not in the Sleeve widget. */
export function isPointCurrency(currency: Currency | undefined): boolean {
  return currency === 'skillPoints' || currency === 'resleevePoints' || currency === 'automationPoints';
}

/**
 * The live numbers behind the formula of a purchase, for the effects that have a formula to fill in.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.actionLevel`, the text table.
 *
 * @param b the purchase
 * @param engine the engine to read the numbers from
 * @param owned copies owned (a purchase not yet owned shows what one copy gives)
 * @param text the display text
 * @returns the variables and the result, or `null` when the effect has no formula to fill in
 */
function purchaseValues(b: BuyableDefinition, engine: LevelQueries & ShopQueries, owned: number, text: UiText): BuyableValues | null {
  if (b.effect.kind !== 'networkGrowthFromActionLevel') return null;
  const level = engine.actionLevel(b.effect.sourceActionId);
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
 * Called by: {@link buildViewModel}. Calls: `GameQueries.ownedCount`, `canBuy`, `costOf`, `isBuyableAvailable`, the text table.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param text the display text
 * @param revealAll test aid: every purchase is `available`, whatever its requirements and reveal rules say
 */
export function buildBuyableViews(engine: LevelQueries & ShopQueries, config: GameConfig, text: UiText, revealAll = false): BuyableView[] {
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
    const costText = formatBigNum(engine.costOf(b.id));
    const costUnit = text.costUnits[engine.currencyOf(b.id)];
    const repeatable = (b.maxPurchases ?? 1) > 1;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      symbol: b.symbol ?? initials(b.name),
      actionId: b.actionId,
      costText,
      costUnit,
      owned,
      repeatable,
      maxed,
      available:
        revealAll || (engine.isBuyableAvailable(b.id) && (SQUARE_EFFECTS.includes(b.effect.kind) || engine.isBuyableRevealed(b.id))),
      affordable,
      toggleable,
      enabled,
      clickable: (toggleable && owned > 0) || (!maxed && affordable),
      ready: repeatable && owned > 0 && !maxed && affordable,
      inSquare: SQUARE_EFFECTS.includes(b.effect.kind),
      get tip() {
        return text.tips.buyable({
          name: b.name,
          description: b.description,
          formula: b.formula ?? null,
          values: purchaseValues(b, engine, owned, text),
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
