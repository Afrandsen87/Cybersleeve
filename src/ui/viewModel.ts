/**
 * @module ui
 *
 * Pure translation of game state into display-ready data. No DOM access, fully testable.
 *
 * @remarks
 * All wording comes from the injected {@link UiText}; this file decides WHAT to show and with which numbers.
 * Hover texts (`tip`, `speedTip`, `backChannelTip`) are getters: they are built when read, because only the tip under the
 * pointer is ever shown. Reading them for every element every frame would throw that saving away.
 */
import type { GameQueries } from '../core';
import { formatBigNum, type NumberFactory, numberFactory } from '../numbers';
import { buildActionViews } from './view/actionView';
import { buildBuyableViews } from './view/buyableViews';
import { inventoryView } from './view/inventoryView';
import { networkView } from './view/networkView';
import { automationView, runsView, skillsView, tabsView } from './view/panelViews';
import { resleeveBuyView, sleeveLevelsOpen } from './view/sleeveGate';
import { sleeveView } from './view/sleeveView';
import type { ViewModel } from './view/viewTypes';
import { type UiText, uiText as defaultText } from './uiText';

export { formatSeconds, statRow } from './view/viewFormat';
export * from './view/viewTypes';

/**
 * Builds the view model for the current engine state.
 *
 * Called by: `ui/dom.ts` every refresh.
 * Calls: {@link GameQueries}, `formatBigNum`, the text table.
 *
 * @param engine the engine to read from
 * @param factory number factory (for formatting numbers that are plain JS values)
 * @param text the display text (default: the placeholder text of the game)
 */
export function buildViewModel(engine: GameQueries, factory: NumberFactory = numberFactory, text: UiText = defaultText): ViewModel {
  return engine.snapshot(() => buildScoped(engine, factory, text));
}

/** The work of {@link buildViewModel}, run inside the engine's snapshot scope so the sleeve stats and skill points are computed once. */
function buildScoped(engine: GameQueries, factory: NumberFactory, text: UiText): ViewModel {
  const state = engine.getState();
  const config = engine.getConfig();

  const stats = engine.sleeveStats();

  const buyableViews = buildBuyableViews(engine, config, text);
  const viewById = new Map(buyableViews.map((v) => [v.id, v]));

  return {
    creditsText: formatBigNum(state.credits),
    creditsLine: text.credits(formatBigNum(state.credits)),
    network: networkView(engine, config, state, stats, text),
    tabs: tabsView(engine, state, config, text),
    skills: skillsView(engine, state, config, buyableViews, viewById, text),
    runs: runsView(state.runs, config, text),
    automation: automationView(engine, config, text),
    inventory: inventoryView(engine, factory, text),
    actions: buildActionViews(engine, config, state, buyableViews, viewById, factory, text),
    sleeve: sleeveView(stats, state, config, buyableViews, viewById, text),
    canResleeve: engine.canResleeve(),
    resleeveShown: sleeveLevelsOpen(state, config),
    resleeveBuy: resleeveBuyView(state, config, viewById),
  };
}
