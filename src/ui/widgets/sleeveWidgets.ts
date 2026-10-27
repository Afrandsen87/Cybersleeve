/**
 * @module ui
 *
 * The Sleeve widget and the two widgets of sleeve-wide purchases beside the Network (Sleeve Improvements and Network Exploitation).
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `statWidget.ts`, `upgradeButtons.ts`.
 */
import type { SleeveView } from '../viewModel';
import { type UiContext, h } from './domKit';
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
  const stats = buildStatWidget('sleeve-widget', initial.title, initial.stats);
  const buttons = new Map<string, HTMLButtonElement>();
  // The sleeve-wide purchases live in two widgets beside Network: the ones paid in nodes in Network Exploitation, the rest in
  // Sleeve Improvements.
  const upgrades = h('aside', 'upgrades-widget');
  upgrades.append(h('h2', undefined, text.titles.upgrades));
  const exploitation = h('aside', 'exploitation-widget');
  exploitation.append(h('h2', undefined, text.titles.exploitation));
  for (const section of initial.sections) {
    if (section.id === 'nodes') addSection(exploitation, section, ctx.activate, buttons, false, icons);
    else addSection(upgrades, section, ctx.activate, buttons, section.id !== 'rebuyable', icons); // the rebuyables are the widget's main content
  }
  return {
    stats,
    upgrades,
    exploitation,
    render(view) {
      renderStats(stats, view.stats, tips);
      renderUpgrades(buttons, view.buyables, tips);
    },
  };
}
