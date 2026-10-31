/**
 * @module ui
 *
 * The heat strip layout (`ui/view/heatStrip.ts`): where heat, the tax start and markers sit on the strip, at any scale.
 *
 * @remarks
 * Called by: Vitest. Calls: `heatStripLayout`.
 */
import { describe, expect, it } from 'vitest';
import { HEAT_STRIP_HEADROOM, heatStripLayout } from './view/heatStrip';

const inRange = (values: readonly number[]) => values.every((v) => Number.isFinite(v) && v >= 0 && v <= 100);

describe('heatStripLayout', () => {
  it('puts no heat at the left edge, and the tax start a headroom short of the end', () => {
    const s = heatStripLayout({ heat: 0, taxStart: 100 });
    expect(s).toMatchObject({ fillPercent: 0, markerPercents: [], overflow: false });
    expect(s.taxStartPercent).toBeCloseTo(100 / HEAT_STRIP_HEADROOM);
  });

  it('places heat inside the strip in proportion to the end', () => {
    const s = heatStripLayout({ heat: 75, taxStart: 100 });
    expect(s.fillPercent).toBeCloseTo(50);
    expect(s.overflow).toBe(false);
  });

  it('pins heat beyond the end at the right edge and flags the overflow', () => {
    const s = heatStripLayout({ heat: 1e9, taxStart: 100 });
    expect([s.fillPercent, s.overflow]).toEqual([100, true]);
  });

  it('with no tax start (the tax is capped) and no markers, scales to the heat itself', () => {
    const s = heatStripLayout({ heat: 40, taxStart: null });
    expect(s.taxStartPercent).toBeNull();
    expect(s.fillPercent).toBeCloseTo(100 / HEAT_STRIP_HEADROOM);
    expect(s.overflow).toBe(false);
    expect(heatStripLayout({ heat: 0, taxStart: null }).fillPercent).toBe(0);
  });

  it('with no tax start, scales to the largest marker', () => {
    const s = heatStripLayout({ heat: 30, taxStart: null, markers: [20, 40] });
    expect(s.markerPercents[1]).toBeCloseTo(100 / HEAT_STRIP_HEADROOM);
    expect(s.fillPercent).toBeCloseTo(50);
  });

  it('never gives NaN: NaN or negative heat is an empty strip, infinite heat a full one that overflows', () => {
    for (const heat of [Number.NaN, -5])
      expect(heatStripLayout({ heat, taxStart: 100 })).toMatchObject({ fillPercent: 0, overflow: false });
    expect(heatStripLayout({ heat: Number.POSITIVE_INFINITY, taxStart: 100 })).toMatchObject({ fillPercent: 100, overflow: true });
    const odd = heatStripLayout({ heat: 1e308, taxStart: 1e308, markers: [Number.NaN, Number.POSITIVE_INFINITY] });
    expect(inRange([odd.fillPercent, odd.taxStartPercent ?? 0, ...odd.markerPercents])).toBe(true);
  });
});
