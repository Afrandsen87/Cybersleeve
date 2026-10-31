/**
 * @module ui
 *
 * The Sleeve widget and the two widgets of sleeve-wide purchases beside the Network (Sleeve Improvements and Network Exploitation).
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `statWidget.ts`, `heatGauge.ts`, `panelHeader.ts`, `upgradeButtons.ts`.
 */
import type { SleeveView } from '../viewModel';
import { type UiContext, h } from './domKit';
import { buildHeatGauge } from './heatGauge';
import { buildPanelHeader } from './panelHeader';
import { type StatWidget, buildStatWidget, renderStats } from './statWidget';
import { addSection, renderUpgrades } from './upgradeButtons';

/** The widgets that show the sleeve. */
export interface SleeveWidgets {
  /** The stat rows of the sleeve. */
  readonly stats: StatWidget;
  /** The rebuyable and one-time purchases paid in credits. */
  readonly upgrades: HTMLElement;
  /** The purchases paid in nodes. */
  readonly exploitation: HTMLElement;
  /** Writes the sleeve view into the widgets. */
  render(view: SleeveView): void;
}

/**
 * Builds the sleeve widgets once.
 *
 * Called by: {@link mountUi}. Calls: {@link buildStatWidget}, {@link addSection}.
 *
 * @param ctx what the widgets need from the screen
 * @param initial the sleeve as the first refresh sees it (decides which purchases exist)
 */
export function mountSleeveWidgets(ctx: UiContext, initial: SleeveView): SleeveWidgets {
  const { text, icons, tips } = ctx;
  const gauge = buildHeatGauge();
  const stats = buildStatWidget('sleeve-widget', initial.title, initial.stats, { groups: initial.groups, under: { heat: gauge.root } });
  const buttons = new Map<string, HTMLButtonElement>();
  // The sleeve-wide purchases live in two widgets beside Network: the ones paid in nodes in Network Exploitation, the rest in
  // Sleeve Improvements.
  const upgrades = h('aside', 'upgrades-widget');
  upgrades.append(buildPanelHeader(text.titles.upgrades).root);
  const exploitation = h('aside', 'exploitation-widget');
  exploitation.append(buildPanelHeader(text.titles.exploitation).root);
  for (const section of initial.sections) {
    if (section.id === 'nodes') addSection(exploitation, section, ctx.activate, buttons, false, icons);
    else addSection(upgrades, section, ctx.activate, buttons, section.id !== 'rebuyable', icons); // the rebuyables are the widget's main content
  }
  return {
    stats,
    upgrades,
    exploitation,
    render(view) {
      renderStats(stats, view.stats, tips, { groups: view.groups, status: view.status });
      gauge.render(view.heatGauge);
      renderUpgrades(buttons, view.buyables, tips);
    },
  };
}
