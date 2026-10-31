/** @module ui
 * Strip geometry. Called by: autoBurnView. Calls: Math helpers.
 */
/** Display span relative to Redline; not game tuning. */
export const STRIP_SPAN_OF_REDLINE = 1.5;
/** Bounded percent positions. Called by: view and panel. Calls: none. */
export interface HeatStripLayout {
  readonly zones: readonly { readonly start: number; readonly end: number }[];
  readonly floor: number;
  readonly redline: number;
  readonly marker: number;
  readonly overflow: boolean;
}
/** Maps heat to finite percents without side effects.
 * Called by: autoBurnView, tests. Calls: Math helpers.
 * @param floor Floor heat
 * @param redline Redline heat
 * @param heat current heat
 * @returns bounded strip positions and overflow indication
 */
export function heatStripLayout(floor: number, redline: number, heat: number): HeatStripLayout {
  const clean = (n: number): number => (Number.isNaN(n) || n < 0 ? 0 : Math.min(n, Number.MAX_VALUE));
  const f = clean(floor);
  const r = Math.max(f, clean(redline));
  const end = Math.max(Math.min(r, Number.MAX_VALUE / STRIP_SPAN_OF_REDLINE) * STRIP_SPAN_OF_REDLINE, Math.min(f + 1, Number.MAX_VALUE), 1);
  const percent = (n: number): number => Math.min(100, (clean(n) / end) * 100);
  const fp = percent(f);
  const rp = percent(r);
  return {
    zones: [
      { start: 0, end: fp },
      { start: fp, end: rp },
      { start: rp, end: 100 },
    ],
    floor: fp,
    redline: rp,
    marker: percent(heat),
    overflow: heat > end,
  };
}
