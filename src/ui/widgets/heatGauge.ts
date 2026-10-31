/**
 * @module ui
 *
 * The heat gauge under the heat row of the Sleeve: a strip with the heat fill, the striped zone where the tax takes every credit,
 * the labels on the strip and the legend line under it. It only draws `SleeveView.heatGauge`; every value comes from the view.
 *
 * @remarks
 * Called by: `ui/widgets/sleeveWidgets.ts`. Calls: `domKit.ts`.
 */
import type { HeatGaugeView } from '../viewModel';
import { h, setFill, setText } from './domKit';

/** The gauge's elements and how to write the view into them. */
export interface HeatGauge {
  readonly root: HTMLElement;
  /** The tax zone; hidden when the view has no tax start. */
  readonly zone: HTMLElement;
  /** The heat fill, scaled from the left with `transform`. */
  readonly fill: HTMLElement;
  /** Draws the gauge, or hides it for `null` (the heat row is hidden). */
  render(view: HeatGaugeView | null): void;
}

/**
 * Builds the gauge once.
 *
 * Called by: {@link mountSleeveWidgets}. Calls: {@link h}.
 */
export function buildHeatGauge(): HeatGauge {
  const fill = h('div', 'hg-fill');
  const zone = h('div', 'hg-zone');
  const value = h('span');
  const zoneLabel = h('span', 'hg-zone-label');
  zone.append(zoneLabel); // inside the zone, so the label never reads as starting before it
  const labels = h('div', 'hg-labels');
  labels.append(value);
  const strip = h('div', 'hg');
  strip.append(fill, zone, labels);
  const legend = h('span', 'hg-bad');
  const legendRow = h('div', 'hg-legend');
  legendRow.append(h('span', undefined, '0'), legend);
  const root = h('div', 'heat-gauge');
  root.append(strip, legendRow);
  root.hidden = true;
  return {
    root,
    zone,
    fill,
    render(view) {
      root.hidden = view === null;
      if (view === null) return;
      setFill(fill, view.strip.fillPercent);
      const start = view.strip.taxStartPercent;
      zone.hidden = start === null;
      if (start !== null) zone.style.left = `${start}%`;
      setText(value, view.valueText);
      setText(zoneLabel, view.zoneText);
      setText(legend, view.legendText);
    },
  };
}
