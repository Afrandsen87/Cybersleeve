/**
 * @module ui
 *
 * A widget made of stat rows (the Sleeve, the Network and the Corporation): built once, then only the changed texts are written.
 * It draws what the view model says: group headers, hidden rows and bars, value tones and the header LED.
 *
 * @remarks
 * Called by: `ui/widgets/sleeveWidgets.ts`, `ui/widgets/corporationPanel.ts`, `ui/dom.ts`. Calls: `domKit.ts`, `panelHeader.ts`.
 */
import type { TipRegistry } from '../tooltip';
import type { StatId } from '../uiText';
import type { StatGroupView, StatRowView } from '../viewModel';
import { type XpBar, h, setText, setXpBar, xpBar } from './domKit';
import { type PanelHeader, buildPanelHeader, setPanelStatus } from './panelHeader';

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
  /** The group header lines, by group id (empty for a flat widget). */
  readonly groupTitles: ReadonlyMap<string, HTMLElement>;
  readonly header: PanelHeader;
}

/** Optional extras of {@link buildStatWidget}. */
export interface StatWidgetOptions {
  /** The groups the rows are drawn in; a header line is placed before the first row of each. Without it the list is flat. */
  readonly groups?: readonly StatGroupView[];
  /** Elements placed under a row (above its cycle bar), e.g. the heat gauge under the heat row. */
  readonly under?: Readonly<Partial<Record<StatId, HTMLElement>>>;
}

/** What {@link renderStats} writes besides the rows. */
export interface StatRenderExtras {
  /** Group visibility; a group whose `hidden` is true hides its header line. */
  readonly groups?: readonly StatGroupView[];
  /** The header LED text; `null` or absent hides the LED. */
  readonly status?: string | null;
}

/**
 * Builds a widget (header and one row per stat, with a cycle bar under the rows that have one).
 *
 * Called by: the panel builders. Calls: {@link buildPanelHeader}, {@link xpBar}.
 *
 * @param className the widget's CSS class
 * @param title the panel title
 * @param stats the rows, in display order
 * @param options group headers and elements placed under rows
 */
export function buildStatWidget(
  className: string,
  title: string,
  stats: readonly StatRowView[],
  options: StatWidgetOptions = {},
): StatWidget {
  const root = h('aside', className);
  const list = h('div', 'stats');
  const rows = new Map<StatId, StatHandle>();
  const groupTitles = new Map<string, HTMLElement>();
  const groupOf = new Map<StatId, StatGroupView>();
  for (const group of options.groups ?? []) for (const id of group.statIds) groupOf.set(id, group);
  for (const stat of stats) {
    const group = groupOf.get(stat.id);
    if (group && !groupTitles.has(group.id)) {
      const line = h('div', `group-title group-${group.id}`, group.title);
      groupTitles.set(group.id, line);
      list.append(line);
    }
    const row = h('div', 'stat');
    const value = h('span', 'stat-value');
    row.append(h('span', 'stat-label', stat.label), value);
    list.append(row);
    const under = options.under?.[stat.id];
    if (under) list.append(under);
    let bar: XpBar | null = null;
    if (stat.bar) {
      bar = xpBar();
      list.append(bar.root);
    }
    rows.set(stat.id, { row, value, bar });
  }
  const header = buildPanelHeader(title);
  root.append(header.root, list);
  return { root, rows, groupTitles, header };
}

/**
 * Writes the stat rows of the view model into a widget.
 *
 * Called by: the panel renderers. Calls: {@link setText}, {@link setXpBar}, {@link setPanelStatus}.
 *
 * @param widget the widget to update
 * @param stats the rows from the view model
 * @param tips where row tips are registered
 * @param extras group visibility and the header LED
 */
export function renderStats(widget: StatWidget, stats: readonly StatRowView[], tips: TipRegistry, extras: StatRenderExtras = {}): void {
  setPanelStatus(widget.header, extras.status ?? null);
  for (const group of extras.groups ?? []) {
    const line = widget.groupTitles.get(group.id);
    if (line) line.hidden = group.hidden;
  }
  for (const stat of stats) {
    const handle = widget.rows.get(stat.id);
    if (!handle) continue;
    handle.row.hidden = stat.hidden;
    if (handle.bar) handle.bar.root.hidden = stat.hidden || (stat.bar?.hidden ?? false);
    setText(handle.value, stat.text);
    if (stat.tone) handle.value.dataset['tone'] = stat.tone;
    else delete handle.value.dataset['tone'];
    tips.set(handle.row, stat.hasTip ? () => stat.tip ?? '' : null);
    if (stat.bar && handle.bar) setXpBar(handle.bar, stat.bar.label, stat.bar.percent);
  }
}
