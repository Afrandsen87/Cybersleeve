/**
 * @module ui
 *
 * The Auto Burn heat strip's geometry: where the zones, the Floor and Redline notches and the heat marker sit, in percent of the strip.
 * Heat has no cap, so the strip spans `0 .. max(Redline × STRIP_SPAN_OF_REDLINE, Floor + 1)` and heat beyond the end pins the marker to
 * the right edge with `overflow` set.
 *
 * @remarks
 * Called by: `autoBurnView.ts`. Calls: nothing.
 */

/** How far the strip reaches, as a multiple of the Redline. A display choice, not game tuning. */
export const STRIP_SPAN_OF_REDLINE = 1.5;

/** One zone of the strip, in percent. */
export interface HeatStripZone {
  readonly start: number;
  readonly end: number;
  /** False for the red zone while the Redline is not shown. */
  readonly visible: boolean;
  /** True for the zone the heat is in now. */
  readonly live: boolean;
}

/** Percent positions (each finite, 0..100) of everything on the strip. */
export interface HeatStripLayout {
  /** Cold (0..Floor), band (Floor..Redline, or to the end without a Redline) and red (Redline..end). */
  readonly zones: readonly HeatStripZone[];
  readonly floor: number;
  readonly redline: number;
  readonly marker: number;
  /** True when heat lies beyond the strip's end (the marker is pinned to the right edge). */
  readonly overflow: boolean;
}

/**
 * The strip's layout. Pure; NaN and negatives read as 0, Infinity is capped, so every percent is finite.
 *
 * Called by: `autoBurnView`. Calls: nothing.
 *
 * @param floor the Floor (lower threshold) in force
 * @param redline the Redline (upper threshold) in force; still sets the strip's scale while it is hidden
 * @param heat current heat
 * @param showRedline false before Redline Trigger is owned: the band runs to the end and the red zone is hidden
 * @returns the zones, notch and marker positions, and whether heat overflows the strip
 */
export function heatStripLayout(floor: number, redline: number, heat: number, showRedline = true): HeatStripLayout {
  const clean = (n: number): number => (Number.isNaN(n) || n < 0 ? 0 : Math.min(n, Number.MAX_VALUE));
  const f = clean(floor);
  const r = Math.max(f, clean(redline));
  const h = clean(heat);
  const end = Math.max(Math.min(r, Number.MAX_VALUE / STRIP_SPAN_OF_REDLINE) * STRIP_SPAN_OF_REDLINE, Math.min(f + 1, Number.MAX_VALUE), 1);
  const percent = (n: number): number => Math.min(100, (clean(n) / end) * 100);
  const fp = percent(f);
  const rp = percent(r);
  const bandEnd = showRedline ? rp : 100;
  const inRed = showRedline && h >= r;
  return {
    zones: [
      { start: 0, end: fp, visible: true, live: h < f },
      { start: fp, end: bandEnd, visible: true, live: h >= f && !inRed },
      { start: rp, end: 100, visible: showRedline, live: inRed },
    ],
    floor: fp,
    redline: rp,
    marker: percent(h),
    overflow: h > end,
  };
}
