/**
 * @module ui
 *
 * The Corporation tab: the corporation widget (rank, owned corporations, employees) and the corporation's actions.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries` (the corporation queries), the text table.
 */
import type { CorporationEffect, CorporationQueries, GameConfig, ShopQueries, StateQueries } from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { corporationActionOf, isCorporate } from './buyableViews';
import { DROP_CHANCE_DECIMALS, buildStatRow as row, formatSeconds } from './viewFormat';
import type { BuyableView, CorporationActionView, CorporationView } from './viewTypes';

/**
 * What the corporation widget shows until the corporation has state of its own (the mechanics behind the figures come later): no
 * corporation has been bought and nobody is employed yet. (The rank is real: it comes from the purchases.)
 */
const STARTING_OWNED_CORPORATIONS = 0;
const STARTING_EMPLOYEES = 0;

/**
 * Says in words what one effect of a corporation action does.
 *
 * Called by: {@link corporationView}. Calls: the text table (one entry per kind of effect).
 *
 * @param effect the configured effect
 * @param itemNames the display name of an item id
 * @param text the display text
 */
function describeEffect(effect: CorporationEffect, itemNames: (id: string) => string, text: UiText): string {
  const describe = text.corporation.effects[effect.kind] as (
    e: CorporationEffect,
    names: (id: string) => string,
    percent: string,
  ) => string;
  const percent = 'chance' in effect ? formatPlain(effect.chance * 100, DROP_CHANCE_DECIMALS) : '';
  return describe(effect, itemNames, percent);
}

/**
 * The Corporation tab.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.corporationActions`, `canStartCorporationAction`.
 *
 * @param engine the engine to read from
 * @param config game configuration (decides which purchases belong to the corporation)
 * @param buyableViews the view of every buyable
 * @param text the display text
 */
export function corporationView(
  engine: CorporationQueries & ShopQueries & StateQueries,
  config: GameConfig,
  buyableViews: readonly BuyableView[],
  text: UiText,
): CorporationView {
  const state = engine.getState();
  const rank = engine.corporateRank();
  const items = engine.getConfig().items.definitions;
  const ownsEffect = (kind: string): boolean =>
    config.buyables.some((b) => b.effect.kind === 'addsCorporationEffect' && b.effect.effect.kind === kind && engine.ownedCount(b.id) > 0);
  const stocksShown = engine.corporationStocks() > 0 || ownsEffect('acquireStock');
  const itemNames = (id: string): string => items.find((d) => d.id === id)?.name ?? id;
  return {
    title: text.titles.corporation,
    stats: [
      row('corporateRank', text, formatPlain(engine.corporateRank())),
      row('ownedCorporations', text, formatPlain(STARTING_OWNED_CORPORATIONS)),
      row('employees', text, formatPlain(STARTING_EMPLOYEES)),
    ],
    holdings: {
      title: text.titles.holdings,
      // the row appears once the purchase that makes stocks is owned, or a stock is held
      stats: [row('stocksOwned', text, formatPlain(engine.corporationStocks()), null, null, !stocksShown)],
    },
    synthPurchase: { title: text.titles.syntheticSleeves, visible: engine.synthPurchaseUnlocked() },
    buyables: buyableViews.filter((b) => isCorporate(config, b.id) && corporationActionOf(config, b.id) === undefined),
    actions: engine.corporationActions().map((def): CorporationActionView => {
      const progress = state.wallet.corporation.actions[def.id];
      const running = progress?.running ?? false;
      const level = engine.corporationLevel(def.id);
      const duration = formatSeconds(engine.corporationRunMs(def.id), text);
      const added = config.buyables.flatMap((b) =>
        b.corporationActionId === def.id && b.effect.kind === 'addsCorporationEffect' && engine.ownedCount(b.id) > 0
          ? [b.effect.effect]
          : [],
      );
      const effects = [...def.effects, ...added].map((e) => describeEffect(e, itemNames, text));
      return {
        id: def.id,
        name: def.name,
        buyables: buyableViews.filter((b) => corporationActionOf(config, b.id) === def.id),
        level,
        levelBarText: text.action.levelBar(
          level,
          formatBigNum(engine.corporationXpIntoLevel(def.id)),
          formatBigNum(engine.corporationXpForLevel(def.id)),
        ),
        levelProgressPercent: engine.corporationLevelProgress(def.id) * 100,
        running,
        progressPercent: (progress?.progress ?? 0) * 100,
        startable: engine.canStartCorporationAction(def.id),
        infoText: rank >= (def.requiredRank ?? 1) ? text.corporation.info(duration) : text.corporation.locked(def.requiredRank ?? 1),
        get tip() {
          return text.corporation.tip({ name: def.name, duration, effects });
        },
      };
    }),
  };
}
