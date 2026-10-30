/**
 * @module ui
 *
 * How the run bar of an action is drawn when its runs are too short to animate: full, with the number of runs per second written on it.
 *
 * @remarks
 * Called by: `actionView.ts`. Calls: `formatPlain`, the text table. Pure: no DOM, no state of its own.
 * A display policy of the UI layer (not game tuning): below {@link FAST_BAR_MS} a bar fills and empties faster than it can be read,
 * so it would only flicker.
 */
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';

/** A run shorter than this many milliseconds draws its bar full instead of animating it. */
export const FAST_BAR_MS = 200;

/** Decimals of the runs per second written on a fast bar. */
const RATE_DECIMALS = 1;

/** How the run bar of one action is drawn. */
export interface FastBarView {
  /** The runs are too short to animate: the bar is drawn full while the action is running. */
  readonly full: boolean;
  /** Runs completed per second, written on the bar; `null` unless the bar is full and Auto-run is on (a single manual run has no rate). */
  readonly rateText: string | null;
}

/**
 * Decides how a run bar is drawn from the action's current run duration (the one owner of that value is the engine's `currentDurationMs`).
 *
 * Called by: `buildActionViews`. Calls: `formatPlain`, `UiText.perSecond`.
 *
 * @param durationMs the current duration of one run in milliseconds (speed, Overclock and Focus already applied)
 * @param running the action is actually running now (an Auto-run that cannot start, e.g. for lack of nodes, is not)
 * @param auto Auto-run is on for the action
 * @param text the display text
 * @returns not full for a normal duration, a zero, negative or non-finite one; full below {@link FAST_BAR_MS} only while `running`, with the rate while `auto` too
 */
export function fastBarView(durationMs: number, running: boolean, auto: boolean, text: UiText): FastBarView {
  const full = running && Number.isFinite(durationMs) && durationMs > 0 && durationMs < FAST_BAR_MS;
  return { full, rateText: full && auto ? text.perSecond(formatPlain(1000 / durationMs, RATE_DECIMALS)) : null };
}
