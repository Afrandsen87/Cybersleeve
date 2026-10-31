/**
 * @module ui
 * Pure heat-strip positions shared by the main screen and the later Auto Burn Floor/Redline panel.
 * Called by: sleeveGroups and future Auto Burn views. Calls: Math only; no side effects.
 */

/** Extra space above the largest strip marker; display policy, not game tuning. */
export const HEAT_STRIP_HEADROOM = 1.5;

/**
 * Strip positions in percent, bounded to 0..100.
 * Called by: heatStripLayout consumers. Calls: none.
 */
export interface HeatStripLayout {
  readonly fillPercent: number;
  readonly taxStartPercent: number | null;
  readonly markerPercents: number[];
  readonly overflow: boolean;
}

/**
 * Places heat, the tax start and optional Auto Burn markers on one strip.
 * Invalid anchors are treated as zero; positive infinite heat pins the strip and overflows.
 * Dividing before applying headroom avoids overflow for very large finite anchors.
 * Called by: sleeveGroups and future Auto Burn views. Calls: Math; mutates no input.
 * @param input current heat, optional tax start, and ordered markers
 * @returns bounded positions and whether heat exceeds the visible scale
 */
export function heatStripLayout(input: { heat: number; taxStart: number | null; markers?: readonly number[] }): HeatStripLayout {
  const markers = input.markers ?? [];
  const anchor = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const heat = Number.isNaN(input.heat) || input.heat < 0 ? 0 : input.heat;
  const maximum = Math.max(anchor(input.taxStart ?? 0), ...markers.map(anchor));
  // The denominator is represented as base * headroom to keep even huge scales finite.
  const base = maximum > 0 ? maximum : Math.max(anchor(heat), 1 / HEAT_STRIP_HEADROOM);
  const position = (value: number): number => Math.min(100, Math.max(0, (value / base / HEAT_STRIP_HEADROOM) * 100));
  return {
    fillPercent: position(heat),
    taxStartPercent: input.taxStart === null ? null : position(anchor(input.taxStart)),
    markerPercents: markers.map((marker) => position(anchor(marker))),
    overflow: heat / base > HEAT_STRIP_HEADROOM,
  };
}
