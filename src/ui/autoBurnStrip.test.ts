/** The Auto Burn heat strip's layout: ordered contiguous zones, the hidden Redline, the live zone, overflow and finite percents. */
import { describe, expect, it } from 'vitest';
import { heatStripLayout } from './view/autoBurnStrip';

describe('Auto Burn strip', () => {
  it('orders Floor before Redline inside the strip, with contiguous zones and the marker between them', () => {
    const v = heatStripLayout(20, 70, 35);
    expect(0).toBeLessThan(v.floor);
    expect(v.floor).toBeLessThan(v.marker);
    expect(v.marker).toBeLessThan(v.redline);
    expect(v.redline).toBeLessThan(100);
    expect(v.zones.map((z) => [z.start, z.end])).toEqual([
      [0, v.floor],
      [v.floor, v.redline],
      [v.redline, 100],
    ]);
    expect(v.overflow).toBe(false);
  });
  it('without the Redline the band runs to the end and the red zone is hidden', () => {
    const v = heatStripLayout(20, 70, 90, false);
    expect(v.zones[1]).toMatchObject({ end: 100, visible: true, live: true });
    expect(v.zones[2]).toMatchObject({ visible: false, live: false });
  });
  it.each([
    [5, 0],
    [20, 1],
    [69, 1],
    [70, 2],
    [1e300, 2],
  ])('marks only the zone heat %s is in (zone %s) as live', (heat, zone) => {
    expect(heatStripLayout(20, 70, heat).zones.map((z) => z.live)).toEqual([0, 1, 2].map((i) => i === zone));
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
