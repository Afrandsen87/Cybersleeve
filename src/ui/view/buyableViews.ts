/**
 * @module ui
 *
 * The view of every buyable, and the groupings of buyables the screen needs (Sleeve sections, re-sleeve skill tiers).
 *
 * @remarks
 * Called by: `ui/viewModel.ts`, `sleeveView.ts`, `skillsView.ts`, `actionView.ts`, `squareView.ts`.
 * Calls: `GameQueries`, the text table.
 */
import { type BuyableDefinition, type Currency, type GameConfig, type LevelQueries, type ShopQueries, traitsOf } from '../../core';
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
  const defs = config.buyables.filter((b) => b.actionId === undefined && !isPointCurrency(b.currency));
  const layout = (['rebuyable', 'oneTime', 'nodes'] as const)
    .map((id) => ({
      id,
      ids: defs
        .filter((b) => sectionOf(b) === id)
        .sort((a, b) => (a.cost.lt(b.cost) ? -1 : a.cost.gt(b.cost) ? 1 : 0))
        .map((b) => b.id),
    }))
    .filter((section) => section.ids.length > 0);
  layoutCache.set(config, layout);
  return layout;
}

/** True for the currencies that are points (skill points, re-sleeve points): their buyables live in the Skills tab, not in the Sleeve widget. */
export function isPointCurrency(currency: Currency | undefined): boolean {
  return currency === 'skillPoints' || currency === 'resleevePoints';
}

/**
 * The re-sleeve skills in rows by depth: a skill that needs nothing is on row 0, any other one row below the deepest skill it needs.
 *
 * Called by: {@link buildViewModel}.
 *
 * @param config game content (decides which buyables are re-sleeve skills and what they require)
 * @param viewById the view of every buyable
 * @returns the rows, top first; a row holds its skills in configuration order
 */
export function resleeveTiers(config: GameConfig, viewById: ReadonlyMap<string, BuyableView>): BuyableView[][] {
  const skills = config.buyables.filter((b) => b.currency === 'resleevePoints');
  const byId = new Map(skills.map((b) => [b.id, b]));
  const depths = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    depths.set(id, 0); // guards against a loop (validation rejects those, this only keeps a bad config from hanging the screen)
    const needs = (byId.get(id)?.requires ?? []).filter((r) => byId.has(r));
    const depth = needs.length === 0 ? 0 : 1 + Math.max(...needs.map(depthOf));
    depths.set(id, depth);
    return depth;
  };
  const tiers: BuyableView[][] = [];
  for (const b of skills) {
    const view = viewById.get(b.id);
    if (view) (tiers[depthOf(b.id)] ??= []).push(view);
  }
  return tiers.filter((tier) => tier !== undefined);
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
 * The view of every buyable in the configuration, in configuration order.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.ownedCount`, `canBuy`, `costOf`, `isBuyableAvailable`, the text table.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param text the display text
 */
export function buildBuyableViews(engine: LevelQueries & ShopQueries, config: GameConfig, text: UiText): BuyableView[] {
  return config.buyables.map((b): BuyableView => {
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
      available: engine.isBuyableAvailable(b.id) && (SQUARE_EFFECTS.includes(b.effect.kind) || engine.isBuyableRevealed(b.id)),
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
