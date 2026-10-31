// @vitest-environment happy-dom
/**
 * @module ui
 * The heat gauge draws only what the view says: fill by transform, tax zone only when it has a start, hidden for null.
 * Called by: vitest. Calls: buildHeatGauge, widgetKit.
 */
import { describe, expect, it } from 'vitest';
import { gaugeView } from '../testing/widgetKit';
import { buildHeatGauge } from './widgets/heatGauge';

describe('heat gauge', () => {
  it('scales the fill with a transform, never with a width', () => {
    const gauge = buildHeatGauge();
    gauge.render(gaugeView({ fillPercent: 40 }));
    expect(gauge.fill.style.transform).toBe('scaleX(0.4)');
    expect(gauge.fill.style.width).toBe('');
  });

  it('starts the tax zone where the view says, and draws no zone when there is no tax start', () => {
    const gauge = buildHeatGauge();
    gauge.render(gaugeView({ taxStartPercent: 70 }));
    expect(gauge.zone.hidden).toBe(false);
    expect(gauge.zone.style.left).toBe('70%');
    gauge.render(gaugeView({ taxStartPercent: null }));
    expect(gauge.zone.hidden).toBe(true);
  });

  it('writes the strip labels and the legend from the view, and hides the whole gauge for null', () => {
    const gauge = buildHeatGauge();
    gauge.render(gaugeView());
    expect(gauge.root.hidden).toBe(false);
    expect(gauge.root.querySelector('.hg-labels')!.textContent).toContain('HEAT 5');
    expect(gauge.root.querySelector('.hg-legend')!.textContent).toBe('0all credits taxed ≥ 10');
    gauge.render(null);
    expect(gauge.root.hidden).toBe(true);
  });
});
