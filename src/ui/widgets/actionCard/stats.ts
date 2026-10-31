/**
 * @module ui
 *
 * The stat grid of an action card: tag and value rows for SPEED, YIELD, RISK (heat lines) and COST (costs).
 *
 * @remarks
 * Called by: `actionCards.ts`. Calls: `domKit.ts`, the tip registry. The RISK and COST rows are told apart by the `kind` of each
 * extra line in the view; nothing here reads text. A row with nothing to say stays hidden (nothing is shown before it matters).
 * A value wider than its box scrolls slowly back and forth (CSS animation; the distance is measured only when the text changes).
 */
import type { TipRegistry } from '../../tooltip';
import type { UiText } from '../../uiText';
import type { ActionExtraKind, ActionView } from '../../viewModel';
import { h } from '../domKit';

/** One tag and value row. */
interface StatRow {
  readonly root: HTMLElement;
  /** The clipped value box (carries the tip). */
  readonly value: HTMLElement;
  /** The text inside it, which scrolls slowly while it is wider than the box. */
  readonly text: HTMLElement;
}

/** Scroll speed of a too-long value, in pixels per second, and the shortest scroll in seconds. */
const SCROLL_PX_PER_SECOND = 18;
const SCROLL_MIN_SECONDS = 4;

/**
 * Starts or stops the slow scroll of a value by comparing its text width with its box. Reads layout, so call it only when the text
 * (or the box) changed.
 *
 * Called by: {@link setStatText}, the resize observer of each row. Calls: nothing.
 */
function measureScroll(row: StatRow): void {
  const overflow = row.text.offsetWidth - row.value.clientWidth;
  const scrolling = overflow > 1;
  row.value.classList.toggle('scrolling', scrolling);
  if (!scrolling) return;
  row.value.style.setProperty('--shift', `${overflow}px`);
  row.value.style.setProperty('--dur', `${Math.max(SCROLL_MIN_SECONDS, overflow / SCROLL_PX_PER_SECOND)}s`);
}

/** Writes a value's text; only a changed text touches the DOM or measures the layout. */
function setStatText(row: StatRow, text: string): void {
  if (row.text.textContent === text) return;
  row.text.textContent = text;
  measureScroll(row);
}

/** Handles to update the stat grid of one card. */
export interface StatGrid {
  /** The grid, to place in the card (it takes the card's reward area). */
  readonly root: HTMLElement;
  /** The SPEED value, which also carries the speed tip. */
  readonly speed: StatRow;
  readonly yield: StatRow;
  readonly risk: StatRow;
  readonly cost: StatRow;
}

/** Builds one row: the tag from the text table, and an empty value. */
function row(className: string, tag: string, valueClass: string): StatRow {
  const root = h('div', `stat-row ${className}`);
  const value = h('span', `stat-val ${valueClass}`);
  const text = h('span', 'stat-text');
  value.append(text);
  root.append(h('span', 'stat-tag', tag), value);
  const built: StatRow = { root, value, text };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => measureScroll(built)).observe(value);
  return built;
}

/**
 * Builds the stat grid of one card once.
 *
 * Called by: `mountActionCards`. Calls: {@link row}.
 *
 * @param text the display text (the tags)
 */
export function buildStatGrid(text: UiText): StatGrid {
  const root = h('div', 'action-reward proc-stats');
  const speed = row('speed', text.action.stats.speed, 'action-info');
  const reward = row('yield', text.action.stats.yield, 'action-gains');
  const risk = row('risk', text.action.stats.risk, 'action-risk');
  const cost = row('cost', text.action.stats.cost, 'action-costs');
  risk.root.hidden = true;
  cost.root.hidden = true;
  root.append(speed.root, reward.root, risk.root, cost.root);
  return { root, speed, yield: reward, risk, cost };
}

/** Writes the lines of one kind into its row, hiding the row when there are none. */
function writeKind(target: StatRow, a: ActionView, kind: ActionExtraKind, text: UiText): void {
  const lines = a.costItems.filter((item) => item.kind === kind).map((item) => item.text);
  target.root.hidden = lines.length === 0;
  setStatText(target, text.action.costs(lines));
}

/**
 * Writes one card's stat grid from its view.
 *
 * Called by: `mountActionCards` (render). Calls: {@link writeKind}, `TipRegistry.set`.
 *
 * @param grid the grid to update
 * @param a the action's view
 * @param text the display text
 * @param tips where the speed tip is registered
 */
export function renderStatGrid(grid: StatGrid, a: ActionView, text: UiText, tips: TipRegistry): void {
  setStatText(grid.speed, a.speedLine);
  tips.set(grid.speed.value, a.unlocked ? () => a.speedTip : null);
  setStatText(grid.yield, a.rewardLine);
  writeKind(grid.risk, a, 'heat', text);
  writeKind(grid.cost, a, 'cost', text);
}
