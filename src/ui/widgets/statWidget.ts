/**
 * @module ui
 *
 * A widget made of stat rows (the Sleeve and the Network): built once, then only the changed texts are written.
 *
 * @remarks
 * Called by: `ui/widgets/sleeveWidgets.ts`, `ui/dom.ts`. Calls: `domKit.ts`.
 */
import type { TipRegistry } from '../tooltip';
import type { StatId } from '../uiText';
import type { StatRowView } from '../viewModel';
import { type XpBar, h, setText, setXpBar, xpBar } from './domKit';

/** Handles to update one stat row. */
interface StatHandle {
  readonly row: HTMLElement;
  readonly value: HTMLElement;
  readonly bar: XpBar | null;
}

/** A widget made of stat rows (the Sleeve and the Network). */
export interface StatWidget {
  readonly root: HTMLElement;
  readonly rows: ReadonlyMap<StatId, StatHandle>;
}

/** Builds a widget (title and one row per stat, with a cycle bar under the rows that have one). */
export function buildStatWidget(className: string, title: string, stats: readonly StatRowView[]): StatWidget {
  const root = h('aside', className);
  const list = h('div', 'stats');
  const rows = new Map<StatId, StatHandle>();
  for (const stat of stats) {
    const row = h('div', 'stat');
    const value = h('span', 'stat-value');
    row.append(h('span', 'stat-label', stat.label), value);
    list.append(row);
    let bar: XpBar | null = null;
    if (stat.bar) {
      bar = xpBar();
      list.append(bar.root);
    }
    rows.set(stat.id, { row, value, bar });
  }
  root.append(h('h2', undefined, title), list);
  return { root, rows };
}

/** Writes the stat rows of the view model into a widget. */
export function renderStats(widget: StatWidget, stats: readonly StatRowView[], tips: TipRegistry): void {
  for (const stat of stats) {
    const handle = widget.rows.get(stat.id);
    if (!handle) continue;
    handle.row.hidden = stat.hidden;
    if (handle.bar) handle.bar.root.hidden = stat.hidden;
    setText(handle.value, stat.text);
    tips.set(handle.row, stat.hasTip ? () => stat.tip ?? '' : null);
    if (stat.bar && handle.bar) setXpBar(handle.bar, stat.bar.label, stat.bar.percent);
  }
}
