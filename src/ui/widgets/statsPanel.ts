/**
 * @module ui
 *
 * The Stats tab: the latest finished sleeve-runs, newest first.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`.
 */
import type { RunRowView, RunsView } from '../viewModel';
import { type UiContext, h } from './domKit';

/** The Stats tab. */
export interface StatsPanel {
  /** The tab's panel, to place in the page. */
  readonly root: HTMLElement;
  /** Redraws the list of runs when it has changed (it only changes at a re-sleeve). */
  render(rows: readonly RunRowView[]): void;
}

/**
 * Builds the Stats tab once.
 *
 * Called by: {@link mountUi}.
 *
 * @param ctx what the panel needs from the screen
 * @param initial the runs as the first refresh sees them (gives the heading)
 */
export function mountStatsPanel(ctx: UiContext, initial: RunsView): StatsPanel {
  const { text } = ctx;
  const statsWidget = h('aside', 'stats-widget');
  const runsTable = h('div', 'runs-table');
  const runsEmpty = h('div', 'runs-empty', text.runs.empty);
  statsWidget.append(h('h2', undefined, initial.title), runsEmpty, runsTable);
  let runsShown = '';
  const root = h('div', 'tab-panel stats-panel');
  root.append(statsWidget);
  return {
    root,
    render(rows) {
      const signature = rows.map((r) => `${r.label}|${r.incomeText}|${r.levelsText}|${r.actionLevelTexts.join(',')}`).join('|');
      if (signature === runsShown) return;
      runsShown = signature;
      runsEmpty.hidden = rows.length > 0;
      const header = h('div', 'run-row run-head');
      header.append(
        h('span', undefined, text.runs.headers.run),
        h('span', undefined, text.runs.headers.income),
        h('span', undefined, text.runs.headers.levels),
      );
      const lines = rows.map((r) => {
        const line = h('div', 'run-row');
        line.append(h('span', undefined, r.label), h('span', undefined, r.incomeText), h('span', undefined, r.levelsText));
        if (r.actionLevelTexts.length > 0) line.append(h('div', 'run-levels', r.actionLevelTexts.join(' · ')));
        return line;
      });
      runsTable.replaceChildren(...(rows.length > 0 ? [header, ...lines] : []));
    },
  };
}
