/**
 * @module ui
 *
 * The Sleeve widget and the Upgrades panel with currency rows beside Network.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `statWidget.ts`, `heatGauge.ts`, `panelHeader.ts`, `upgradeButtons.ts`.
 */
import type { SleeveView } from '../viewModel';
import { type UiContext, h } from './domKit';
import { buildHeatGauge } from './heatGauge';
import { buildPanelHeader } from './panelHeader';
import { type StatWidget, buildStatWidget, renderStats } from './statWidget';
import { upgradeRow, renderUpgrades } from './upgradeButtons';

/** The widgets that show the sleeve. */
export interface SleeveWidgets {
  /** The stat rows of the sleeve. */
  readonly stats: StatWidget;
  /** The purchases in currency rows. */
  readonly upgrades: HTMLElement;
  /** Writes the sleeve view into the widgets. */
  render(view: SleeveView): void;
}

/**
 * Builds the sleeve widgets once.
 *
 * Called by: {@link mountUi}. Calls: {@link buildStatWidget}, {@link upgradeRow}.
 *
 * @param ctx what the widgets need from the screen
 * @param initial the sleeve as the first refresh sees it (decides which purchases exist)
 */
export function mountSleeveWidgets(ctx: UiContext, initial: SleeveView): SleeveWidgets {
  const { text, icons, tips } = ctx;
  const gauge = buildHeatGauge();
  const stats = buildStatWidget('sleeve-widget', initial.title, initial.stats, { groups: initial.groups, under: { heat: gauge.root } });
  const buttons = new Map<string, HTMLButtonElement>();
  const upgrades = h('aside', 'upgrades-widget');
  upgrades.append(buildPanelHeader(text.titles.upgrades).root);
  const rows = new Map(
    initial.sections.map((section) => {
      const row = upgradeRow(section.buyables, ctx.activate, icons, text.upgradeTiles);
      const root = h('div', 'shop-row');
      root.append(h('span', 'row-label', section.title), row.element);
      upgrades.append(root);
      for (const [id, button] of row.buttons) buttons.set(id, button);
      return [section.id, root] as const;
    }),
  );
  return {
    stats,
    upgrades,
    render(view) {
      renderStats(stats, view.stats, tips, { groups: view.groups, status: view.status });
      gauge.render(view.heatGauge);
      renderUpgrades(buttons, view.buyables, tips);
      for (const section of view.sections) {
        const row = rows.get(section.id);
        if (!row) continue;
        row.hidden = !section.buyables.some((b) => b.available);
      }
    },
  };
}
