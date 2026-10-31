/** Strip display invariants. Called by: Vitest. Calls: heatStripLayout. */
import { describe, expect, it } from 'vitest';
import { heatStripLayout, STRIP_SPAN_OF_REDLINE } from './view/autoBurnStrip';

describe('Auto Burn strip', () => {
  it('uses 1.5 times Redline and contiguous zones', () => {
    const v = heatStripLayout(20, 70, 35);
    expect(STRIP_SPAN_OF_REDLINE).toBe(1.5);
    expect(v.floor).toBeCloseTo((20 / 105) * 100);
    expect(v.redline).toBeCloseTo((70 / 105) * 100);
    expect(v.zones).toEqual([
      { start: 0, end: v.floor },
      { start: v.floor, end: v.redline },
      { start: v.redline, end: 100 },
    ]);
    expect(v.marker).toBeCloseTo((35 / 105) * 100);
  });
  it('pins huge heat and signals overflow', () => {
    expect(heatStripLayout(49, 50, 1e308)).toMatchObject({ marker: 100, overflow: true });
    expect(heatStripLayout(0, 0, 0)).toMatchObject({ marker: 0, overflow: false });
    expect(heatStripLayout(0, 0, 0.5).marker).toBe(50);
  });
  it.each([0, -1, NaN, Infinity, -Infinity, 1e308, Number.MAX_VALUE])('keeps every percent finite for %s', (value) => {
    for (const v of [heatStripLayout(value, value, value), heatStripLayout(0, 1, value), heatStripLayout(49, 50, value)]) {
      const positions = [v.floor, v.redline, v.marker, ...v.zones.flatMap((z) => [z.start, z.end])];
      for (const p of positions) {
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      }
    }
  });
});
